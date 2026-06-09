import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";
import { computeNextOutreachAt } from "@/lib/execution/outreachSchedule";
import { localTimeToUtcHHmm } from "@/lib/outreachTimezones";
import {
  enrollContactInCampaign,
  flattenContactCampaign,
  resolveOrCreateContact,
} from "@/lib/resolveBusinessUser";

export async function addContactToCampaign(request, campaignId, tenantId) {
  const campaign = await getOwnedCampaignDetail(campaignId, tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const contact = await resolveOrCreateContact(tx, tenantId, {
      company: body.company,
      name: body.name,
      firstName: body.firstName,
      lastName: body.lastName,
      jobTitle: body.jobTitle,
      persona: body.persona,
      phone: body.phone,
      whatsapp: body.whatsapp,
      email: body.email,
      linkedinUrl: body.linkedinUrl,
      twitterId: body.twitterId,
    });

    const deliveryUtc = body.outreachDeliveryTime
      ? localTimeToUtcHHmm(
          body.outreachDeliveryTime,
          campaign.outreachTimezone ?? "UTC"
        )
      : null;

    const nextAt = computeNextOutreachAt({
      campaign,
      contactCampaign: { outreachDeliveryTime: deliveryUtc },
    });

    await enrollContactInCampaign(tx, {
      contactId: contact.id,
      campaignId: campaign.id,
      outreachDeliveryTime: deliveryUtc,
      nextScheduledOutreachAt: nextAt,
    });
  });

  const serialized = await fetchSerializedCampaign(campaignId, tenantId);
  return NextResponse.json(serialized, { status: 201 });
}

export async function patchContactCampaign(
  request,
  campaignId,
  tenantId,
  contactCampaignId
) {
  const campaign = await getOwnedCampaignDetail(campaignId, tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const contactCampaign = campaign.contactCampaigns.find(
    (cc) => cc.id === contactCampaignId
  );
  if (!contactCampaign) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = {};
  if (body.outreachDeliveryTime !== undefined) {
    const t = body.outreachDeliveryTime?.trim() || null;
    if (t && !/^\d{1,2}:\d{2}$/.test(t)) {
      return NextResponse.json(
        { error: "outreachDeliveryTime must be HH:mm" },
        { status: 400 }
      );
    }
    data.outreachDeliveryTime = t
      ? localTimeToUtcHHmm(t, campaign.outreachTimezone ?? "UTC")
      : null;
  }

  if (body.status !== undefined) {
    const valid = [
      "PENDING",
      "IN_OUTREACH",
      "REPLIED",
      "QUALIFIED",
      "NOT_QUALIFIED",
      "DISQUALIFIED",
      "PAUSED",
    ];
    if (!valid.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === "QUALIFIED" && !contactCampaign.qualifiedAt) {
      data.qualifiedAt = new Date();
      data.qualifiedReason = body.qualifiedReason ?? "manual";
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const flat = flattenContactCampaign(contactCampaign);
  data.nextScheduledOutreachAt = computeNextOutreachAt({
    campaign,
    contactCampaign: { ...flat, ...data },
  });

  await prisma.contactCampaign.update({
    where: { id: contactCampaignId },
    data,
  });

  const serialized = await fetchSerializedCampaign(campaignId, tenantId);
  return NextResponse.json(serialized);
}

export async function removeContactCampaign(
  campaignId,
  tenantId,
  contactCampaignId
) {
  const campaign = await getOwnedCampaignDetail(campaignId, tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const contactCampaign = campaign.contactCampaigns.find(
    (cc) => cc.id === contactCampaignId
  );
  if (!contactCampaign) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  await prisma.contactCampaign.delete({ where: { id: contactCampaignId } });

  const serialized = await fetchSerializedCampaign(campaignId, tenantId);
  return NextResponse.json(serialized);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";
import { computeNextOutreachAt } from "@/lib/execution/outreachSchedule";
import { localTimeToUtcHHmm, isAllowedOutreachTimezone, normalizeOutreachTimezone } from "@/lib/outreachTimezones";
import {
  enrollContactInCampaign,
  flattenCampaignContact,
  resolveOrCreateContact,
  updateBusinessUserContact,
} from "@/lib/resolveBusinessUser";
import { enqueueQualifiedCrmPush } from "@/lib/crm/pushQualifiedToHubspot";

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
      campaignContact: { outreachDeliveryTime: deliveryUtc },
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

export async function patchCampaignContact(
  request,
  campaignId,
  tenantId,
  campaignContactId
) {
  const campaign = await getOwnedCampaignDetail(campaignId, tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaignContact = campaign.campaignContacts.find(
    (cc) => cc.id === campaignContactId
  );
  if (!campaignContact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = {};
  const contactFields = {};
  const contactFieldKeys = [
    "name",
    "firstName",
    "lastName",
    "company",
    "jobTitle",
    "email",
    "phone",
    "whatsapp",
    "linkedinUrl",
    "twitterId",
  ];
  for (const key of contactFieldKeys) {
    if (body[key] !== undefined) {
      contactFields[key] = body[key];
    }
  }

  if (body.outreachDeliveryTime !== undefined) {
    const t = body.outreachDeliveryTime?.trim() || null;
    if (t && !/^\d{1,2}:\d{2}$/.test(t)) {
      return NextResponse.json(
        { error: "outreachDeliveryTime must be HH:mm" },
        { status: 400 }
      );
    }
    const tzSource =
      body.outreachDeliveryTimezone !== undefined
        ? body.outreachDeliveryTimezone
        : campaign.outreachTimezone ?? "UTC";
    if (
      body.outreachDeliveryTimezone !== undefined &&
      !isAllowedOutreachTimezone(body.outreachDeliveryTimezone)
    ) {
      return NextResponse.json(
        { error: "Invalid outreach delivery timezone" },
        { status: 400 }
      );
    }
    const tz = normalizeOutreachTimezone(tzSource);
    data.outreachDeliveryTime = t ? localTimeToUtcHHmm(t, tz) : null;
    data.lastOutreachDate = null;
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
    if (body.status === "QUALIFIED" && !campaignContact.qualifiedAt) {
      data.qualifiedAt = new Date();
      data.qualifiedReason = body.qualifiedReason ?? "manual";
    }
  }

  if (Object.keys(data).length === 0 && Object.keys(contactFields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const businessUserId = campaignContact.contact?.businessUser?.id;
  if (Object.keys(contactFields).length > 0) {
    if (!businessUserId) {
      return NextResponse.json({ error: "Contact record not found" }, { status: 404 });
    }
    try {
      await prisma.$transaction(async (tx) => {
        await updateBusinessUserContact(tx, businessUserId, contactFields);
      });
    } catch (err) {
      const message = err?.message ?? "Failed to update contact";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const becameQualified =
    data.status === "QUALIFIED" && campaignContact.status !== "QUALIFIED";

  if (Object.keys(data).length > 0) {
    const flat = flattenCampaignContact(campaignContact);
    data.nextScheduledOutreachAt = computeNextOutreachAt({
      campaign,
      campaignContact: { ...flat, ...data },
    });

    await prisma.campaignContact.update({
      where: { id: campaignContactId },
      data,
    });

    if (becameQualified) {
      enqueueQualifiedCrmPush(prisma, campaignContactId);
    }
  }

  const serialized = await fetchSerializedCampaign(campaignId, tenantId);
  return NextResponse.json(serialized);
}

export async function removeCampaignContact(
  campaignId,
  tenantId,
  campaignContactId
) {
  const campaign = await getOwnedCampaignDetail(campaignId, tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaignContact = campaign.campaignContacts.find(
    (cc) => cc.id === campaignContactId
  );
  if (!campaignContact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  await prisma.campaignContact.delete({ where: { id: campaignContactId } });

  const serialized = await fetchSerializedCampaign(campaignId, tenantId);
  return NextResponse.json(serialized);
}

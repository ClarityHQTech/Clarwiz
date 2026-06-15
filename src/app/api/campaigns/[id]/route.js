import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";
import { seedCampaignProspectSchedules } from "@/lib/execution/outreachSchedule";
import { registerWebhooksForTenant } from "@/lib/execution/registerIntegrationWebhooks";
import {
  isAllowedOutreachTimezone,
  localTimeToUtcHHmm,
  normalizeOutreachTimezone,
} from "@/lib/outreachTimezones";
import { normalizeEnabledChannels } from "@/lib/campaignChannels";
import {
  getConnectedSmartleadInboxes,
  resolveCampaignSmartleadAccountIds,
} from "@/lib/emailIntegration";
import { linkCampaignEmailAccounts } from "@/lib/smartleadApi";

export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const serialized = await fetchSerializedCampaign(params.id, ctx.tenantId);
  if (!serialized) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(serialized);
}

export async function PATCH(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const campaign = await getOwnedCampaignDetail(params.id, ctx.tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "start") {
    if (campaign.campaignContacts.length === 0) {
      return NextResponse.json(
        { error: "Add prospects before starting the drip campaign" },
        { status: 400 }
      );
    }
    if (campaign.status === "active") {
      return NextResponse.json(
        { error: "Drip campaign is already running" },
        { status: 400 }
      );
    }
    if (campaign.status === "completed") {
      return NextResponse.json(
        { error: "Cannot start a completed campaign" },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "active",
        startDate: campaign.startDate ?? new Date(),
      },
    });

    await seedCampaignProspectSchedules(campaign.id);
    registerWebhooksForTenant(ctx.tenantId, { campaignId: campaign.id }).catch(
      (err) => console.warn("[campaign start] webhook registration:", err.message)
    );

    return NextResponse.json(await fetchSerializedCampaign(params.id, ctx.tenantId));
  }

  if (
    body.outreachTimezone !== undefined ||
    body.defaultOutreachTime !== undefined
  ) {
    const data = {};
    const tz =
      body.outreachTimezone !== undefined
        ? normalizeOutreachTimezone(body.outreachTimezone)
        : normalizeOutreachTimezone(campaign.outreachTimezone);

    if (body.outreachTimezone !== undefined) {
      if (!isAllowedOutreachTimezone(body.outreachTimezone)) {
        return NextResponse.json(
          { error: "Invalid outreach timezone" },
          { status: 400 }
        );
      }
      data.outreachTimezone = tz;
    }

    if (body.defaultOutreachTime !== undefined) {
      const t = body.defaultOutreachTime?.trim();
      if (t && !/^\d{1,2}:\d{2}$/.test(t)) {
        return NextResponse.json(
          { error: "defaultOutreachTime must be HH:mm" },
          { status: 400 }
        );
      }
      data.defaultOutreachTime = localTimeToUtcHHmm(t || "11:00", tz);
    }

    await prisma.campaign.update({ where: { id: campaign.id }, data });

    if (campaign.status === "active") {
      await seedCampaignProspectSchedules(campaign.id);
    }

    return NextResponse.json(await fetchSerializedCampaign(params.id, ctx.tenantId));
  }

  if (body.calendlyBookingUrl !== undefined) {
    const url = body.calendlyBookingUrl?.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "Calendly URL must start with http:// or https://" },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { calendlyBookingUrl: url },
    });

    return NextResponse.json(await fetchSerializedCampaign(params.id, ctx.tenantId));
  }

  if (
    body.name !== undefined ||
    body.description !== undefined ||
    body.targetSegment !== undefined ||
    body.goals !== undefined ||
    body.startDate !== undefined
  ) {
    const data = {};

    if (body.name !== undefined) {
      const name = body.name?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Campaign name is required" },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }

    if (body.targetSegment !== undefined) {
      data.targetSegment = body.targetSegment?.trim() || null;
    }

    if (body.goals !== undefined) {
      data.goals = body.goals?.trim() || null;
    }

    if (body.startDate !== undefined) {
      const raw = body.startDate?.trim();
      if (!raw) {
        data.startDate = null;
      } else {
        const parsed = new Date(`${raw}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "Invalid start date" },
            { status: 400 }
          );
        }
        data.startDate = parsed;
      }
    }

    await prisma.campaign.update({ where: { id: campaign.id }, data });

    return NextResponse.json(await fetchSerializedCampaign(params.id, ctx.tenantId));
  }

  if (body.enabledChannels !== undefined) {
    const enabledChannels = normalizeEnabledChannels(body.enabledChannels);
    if (enabledChannels.length === 0) {
      return NextResponse.json(
        { error: "Select at least one outreach channel" },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { enabledChannels },
    });

    return NextResponse.json(await fetchSerializedCampaign(params.id, ctx.tenantId));
  }

  if (body.smartleadInboxIds !== undefined) {
    const requestedIds = Array.isArray(body.smartleadInboxIds)
      ? body.smartleadInboxIds.filter(Boolean)
      : [];
    const connected = await getConnectedSmartleadInboxes(ctx.tenantId);
    const validIds = new Set(connected.map((inbox) => inbox.id));
    const smartleadInboxIds = requestedIds.filter((inboxId) => validIds.has(inboxId));

    if (requestedIds.length > 0 && smartleadInboxIds.length === 0) {
      return NextResponse.json(
        { error: "Selected Smartlead inboxes are not connected for this workspace" },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { smartleadInboxIds },
    });

    if (campaign.smartleadCampaignId) {
      try {
        const accountIds = await resolveCampaignSmartleadAccountIds(
          { ...campaign, smartleadInboxIds },
          ctx.tenantId
        );
        await linkCampaignEmailAccounts(
          Number(campaign.smartleadCampaignId),
          accountIds
        );
      } catch (err) {
        console.warn("[campaign] Smartlead inbox sync failed:", err.message);
      }
    }

    return NextResponse.json(await fetchSerializedCampaign(params.id, ctx.tenantId));
  }

  if (body.action === "pause") {
    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "Only active campaigns can be paused" },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "paused" },
    });

    return NextResponse.json(await fetchSerializedCampaign(params.id, ctx.tenantId));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

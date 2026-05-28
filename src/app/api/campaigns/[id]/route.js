import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";

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
    if (campaign.prospects.length === 0) {
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

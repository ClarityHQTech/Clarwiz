import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import {
  markProspectQualified,
  QUALIFICATION_REASONS,
} from "@/lib/execution/qualifyProspect";

export async function GET(request, { params }) {
  const campaignId = params.id;
  const { searchParams } = new URL(request.url);
  const prospectId = searchParams.get("prospectId");

  if (!prospectId) {
    return NextResponse.json({ error: "prospectId is required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, calendlyBookingUrl: true },
  });

  if (!campaign?.calendlyBookingUrl?.trim()) {
    return NextResponse.json(
      { error: "Campaign has no Calendly booking URL configured" },
      { status: 404 }
    );
  }

  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, campaignId },
  });

  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }

  const latestLog = await prisma.communicationLog.findFirst({
    where: { campaignId, prospectId },
    orderBy: { sentAt: "desc" },
  });

  if (latestLog) {
    await prisma.communicationLog.update({
      where: { id: latestLog.id },
      data: { ctaClickedAt: new Date() },
    });
  }

  await markProspectQualified(prisma, {
    prospectId,
    campaignId,
    reason: QUALIFICATION_REASONS.CALENDLY_LINK_CLICKED,
    sourceMeta: { trackedLink: true },
  });

  await syncCampaignMetrics(prisma, campaignId);

  const dest = new URL(campaign.calendlyBookingUrl.trim());
  dest.searchParams.set("utm_source", "clarwiz");
  dest.searchParams.set("utm_campaign", campaignId);
  dest.searchParams.set("utm_content", prospectId);

  return NextResponse.redirect(dest.toString(), 302);
}

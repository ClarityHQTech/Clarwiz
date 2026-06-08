import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { isLinkPreviewBotRequest } from "@/lib/execution/bookingLinkClick";
import {
  markContactCampaignQualified,
  QUALIFICATION_REASONS,
} from "@/lib/execution/qualifyContact";

async function buildCalendlyRedirect(campaignId, prospectId, calendlyBookingUrl) {
  const dest = new URL(calendlyBookingUrl.trim());
  dest.searchParams.set("utm_source", "clarwiz");
  dest.searchParams.set("utm_campaign", campaignId);
  dest.searchParams.set("utm_content", prospectId);
  return dest.toString();
}

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

  const cc = await prisma.contactCampaign.findFirst({
    where: { id: prospectId, campaignId },
  });

  if (!cc) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const redirectUrl = await buildCalendlyRedirect(
    campaignId,
    prospectId,
    campaign.calendlyBookingUrl
  );

  if (isLinkPreviewBotRequest(request)) {
    return NextResponse.redirect(redirectUrl, 302);
  }

  const latestLog = await prisma.communicationLog.findFirst({
    where: { campaignId, contactCampaignId: prospectId },
    orderBy: { sentAt: "desc" },
  });

  if (latestLog && !latestLog.ctaClickedAt) {
    await prisma.communicationLog.update({
      where: { id: latestLog.id },
      data: { ctaClickedAt: new Date() },
    });
  }

  const qualifyResult = await markContactCampaignQualified(prisma, {
    contactCampaignId: prospectId,
    campaignId,
    reason: QUALIFICATION_REASONS.CALENDLY_LINK_CLICKED,
    sourceMeta: { trackedLink: true },
  });

  if (qualifyResult.updated) {
    await syncCampaignMetrics(prisma, campaignId);
  }

  return NextResponse.redirect(redirectUrl, 302);
}

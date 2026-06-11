import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMofuIntegration, getAssistCalendlyBookingUrl } from "@/lib/assist/mofuIntegration";
import { logAssistAction } from "@/lib/assist/logAction";
import { isLinkPreviewBotRequest } from "@/lib/execution/bookingLinkClick";

function buildCalendlyRedirect(dealId, calendlyBookingUrl, { nbaId, hubspotDealId } = {}) {
  const dest = new URL(calendlyBookingUrl.trim());
  dest.searchParams.set("utm_source", "clarwiz");
  dest.searchParams.set("utm_medium", "ae_assist");
  dest.searchParams.set("utm_campaign", dealId);
  if (nbaId) dest.searchParams.set("utm_content", nbaId);
  if (hubspotDealId) dest.searchParams.set("utm_term", hubspotDealId);
  return dest.toString();
}

/** GET — tracked redirect from an NBA email to the tenant's Calendly booking URL. */
export async function GET(request, { params }) {
  const { id: dealId } = await params;
  const { searchParams } = new URL(request.url);
  const nbaId = searchParams.get("nbaId");

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, tenantId: true, hubspotDealId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }

  const integration = await getMofuIntegration(prisma, deal.tenantId);
  const calendlyBookingUrl = getAssistCalendlyBookingUrl(integration);
  if (!calendlyBookingUrl) {
    return NextResponse.json(
      { error: "Calendly booking URL is not configured in AE Assist settings" },
      { status: 404 }
    );
  }

  const redirectUrl = buildCalendlyRedirect(dealId, calendlyBookingUrl, {
    nbaId,
    hubspotDealId: deal.hubspotDealId,
  });

  if (!isLinkPreviewBotRequest(request)) {
    await logAssistAction(prisma, {
      tenantId: deal.tenantId,
      entityType: "deal",
      hsObjectId: deal.hubspotDealId ?? null,
      action: "NBA_EXECUTED",
      payload: { dealId, nbaId, kind: "calendly_link_clicked" },
    }).catch(() => {});
  }

  return NextResponse.redirect(redirectUrl, 302);
}

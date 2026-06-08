import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { fetchDealMeetingNotes } from "@/lib/assist/hubspotRead";

/**
 * GET — pull the deal's HubSpot meeting bodies + notes (the note-taker output
 * recorded in HubSpot) so the AE can pre-fill the post-meeting textarea instead
 * of pasting by hand.
 *
 * Returns { ok, text, count }. 412 when HubSpot is not configured. When the
 * appointments/meetings read scope is missing (or there is simply nothing to
 * fetch), `fetchDealMeetingNotes` degrades to ok:false — we surface that as a
 * 200 { ok:false, reason:'write_scope', text:'', count:0 } so the UI shows a
 * gentle "connect appointments scope / nothing yet" note rather than an error.
 *
 * NOTE: call transcripts/recordings (crm.extensions_calling_transcripts) are out
 * of scope here; only meeting bodies + notes are fetched.
 */
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: ctx.tenantId },
    select: { id: true, hubspotDealId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }

  const token = await getDecryptedHubspotToken(prisma, ctx.tenantId);
  if (!token) {
    return NextResponse.json({ ok: false, error: "hubspot_not_configured" }, { status: 412 });
  }

  const res = await fetchDealMeetingNotes(token, deal.hubspotDealId);

  if (!res.ok) {
    // Scope missing or nothing to fetch — let the UI show a helpful note.
    return NextResponse.json({ ok: false, reason: "write_scope", text: "", count: 0 });
  }

  return NextResponse.json({ ok: true, text: res.text, count: res.sources.length });
}

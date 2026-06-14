import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { addNote } from "@/lib/assist/hubspotWrite";
import { recomputeSignals } from "@/lib/assist/intelligence/compute";
import { logAssistAction } from "@/lib/assist/logAction";

/**
 * POST { notes } — capture POST-MEETING NOTES.
 *
 * 1. Writes the notes onto the deal's HubSpot timeline (addNote) so they become
 *    engagement text.
 * 2. Re-runs signal extraction (`recomputeSignals`) over the deal's engagements
 *    — the freshly-added notes are exactly the call/meeting text that produces
 *    new Signals. Fenced: a recompute failure (no LLM key, provider error) must
 *    not fail the note write; the notes are already saved.
 * 3. Logs NOTE_ADDED.
 *
 * Returns { ok, signalCount }. 412 when HubSpot is not configured; on a 403
 * write-scope error returns { ok:false, reason:'write_scope' }.
 */
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.HUBSPOT_WRITE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId, nbaId } = await params;

  let body = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!notes) {
    return NextResponse.json({ ok: false, error: "empty_notes" }, { status: 400 });
  }

  // nbaId is part of the path but optional for this flow; resolve the deal directly.
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

  const noteRes = await addNote(token, {
    dealId: deal.hubspotDealId,
    body: `Post-meeting notes:\n\n${notes}`,
  });
  if (!noteRes.ok) {
    if (noteRes.status === 403) {
      return NextResponse.json({ ok: false, reason: "write_scope" });
    }
    return NextResponse.json({ ok: false, reason: "hubspot_error", status: noteRes.status });
  }

  // Feed the notes into signal extraction. Fenced — ok if it no-ops (no key /
  // no engagements yet) or throws; the note is already on the timeline.
  let signalCount = 0;
  let providerFields = {};
  try {
    const sigRes = await recomputeSignals(prisma, ctx.tenantId, dealId);
    signalCount = Array.isArray(sigRes.signals) ? sigRes.signals.length : 0;
    providerFields = {
      modelUsed: sigRes.modelUsed ?? null,
      providerUsage: sigRes.providerUsage ?? null,
      providerCost: sigRes.providerCost ?? null,
    };
  } catch (err) {
    console.warn(`[MOFU] post-meeting recomputeSignals failed: ${err.message}`);
  }

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: deal.hubspotDealId,
    action: "NOTE_ADDED",
    payload: { id: noteRes.id, nbaId: nbaId ?? null, postMeeting: true, signalCount },
    ...providerFields,
  });

  return NextResponse.json({ ok: true, signalCount });
}

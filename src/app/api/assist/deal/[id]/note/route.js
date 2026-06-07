import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { addNote } from "@/lib/assist/hubspotWrite";
import { logAssistAction } from "@/lib/assist/logAction";

/**
 * POST { body } — write a note onto the deal in HubSpot and log NOTE_ADDED.
 * 412 when HubSpot is not configured; { ok:false, reason:'write_scope' } on 403.
 */
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.HUBSPOT_WRITE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId } = await params;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const noteBody = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!noteBody) {
    return NextResponse.json({ error: "empty_note" }, { status: 400 });
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: ctx.tenantId },
    select: { id: true, hubspotDealId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }

  const token = await getDecryptedHubspotToken(prisma, ctx.tenantId);
  if (!token) {
    return NextResponse.json({ error: "hubspot_not_configured" }, { status: 412 });
  }

  const res = await addNote(token, { dealId: deal.hubspotDealId, body: noteBody });
  if (!res.ok) {
    if (res.status === 403) {
      return NextResponse.json({ ok: false, reason: "write_scope" });
    }
    return NextResponse.json({ ok: false, reason: "hubspot_error", status: res.status });
  }

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: deal.hubspotDealId,
    action: "NOTE_ADDED",
    payload: { id: res.id },
  });

  return NextResponse.json({ ok: true, id: res.id });
}

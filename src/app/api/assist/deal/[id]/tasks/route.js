import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { createTask } from "@/lib/assist/hubspotWrite";
import { logAssistAction } from "@/lib/assist/logAction";

/**
 * POST { steps: [{ subject, body }] } — create one HubSpot task per GTM path
 * step, associated to the deal. Degrades gracefully: 412 when no token, and a
 * non-crashing { ok:false, reason:'write_scope' } when HubSpot rejects with 403.
 */
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.HUBSPOT_WRITE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const steps = Array.isArray(body?.steps)
    ? body.steps
        .filter((s) => s && typeof s === "object" && typeof s.subject === "string" && s.subject.trim())
        .map((s) => ({ subject: s.subject.trim(), body: typeof s.body === "string" ? s.body : "" }))
    : [];

  if (!steps.length) {
    return NextResponse.json({ error: "no_steps" }, { status: 400 });
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

  const created = [];
  let scopeBlocked = false;

  for (const step of steps) {
    const res = await createTask(token, {
      dealId: deal.hubspotDealId,
      subject: step.subject,
      body: step.body,
    });
    if (res.ok) {
      created.push({ subject: step.subject, id: res.id });
    } else if (res.status === 403) {
      scopeBlocked = true;
      break;
    }
    // other non-fatal failures are simply skipped from `created`
  }

  if (scopeBlocked && !created.length) {
    return NextResponse.json({ ok: false, reason: "write_scope" });
  }

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: deal.hubspotDealId,
    action: "TASK_CREATED",
    payload: { subjects: created.map((c) => c.subject) },
  });

  return NextResponse.json({
    ok: true,
    created,
    ...(scopeBlocked ? { reason: "write_scope", partial: true } : {}),
  });
}

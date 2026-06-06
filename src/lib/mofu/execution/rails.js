import { prisma as defaultPrisma } from "@/lib/prisma";
import { runExecutor as defaultRunExecutor } from "@/lib/mofu/execution/executors";
import { OUTBOUND_ACTIONS } from "@/lib/mofu/nbaActions";

// US-6.1 — Universal execution rails: card -> draft -> editor -> approve -> send -> tracked.
// Status flow: SUGGESTED -> DRAFTED -> EDITED -> APPROVED -> SENT / FAILED.

function appendAudit(payload, entry) {
  const audit = Array.isArray(payload?.audit) ? payload.audit : [];
  return { ...(payload ?? {}), audit: [...audit, { ...entry, at: new Date().toISOString() }] };
}

function defaultDraft(rec) {
  return { subject: rec.title, body: rec.payload?.rationale ?? rec.title };
}

async function loadRec(prisma, tenantId, recId) {
  return prisma.nbaRecommendation.findFirst({ where: { id: recId, tenantId }, include: { deal: true } });
}

/** Generate (or apply edited) draft. edits present -> EDITED, else DRAFTED. */
export async function draftRecommendation({ tenantId, recId, edits = null }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const rec = await loadRec(prisma, tenantId, recId);
  if (!rec) return { ok: false, reason: "not_found", status: 404 };
  const draft = edits ?? (deps.generateDraft ? await deps.generateDraft(rec) : defaultDraft(rec));
  const updated = await prisma.nbaRecommendation.update({
    where: { id: rec.id },
    data: { status: edits ? "EDITED" : "DRAFTED", payload: { ...(rec.payload ?? {}), draft } },
  });
  return { ok: true, recommendation: updated, draft };
}

/** Mandatory approve gate for outbound. Requires nba:approve at the route. */
export async function approveRecommendation({ tenantId, recId, actor = null }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const rec = await loadRec(prisma, tenantId, recId);
  if (!rec) return { ok: false, reason: "not_found", status: 404 };
  if (!["DRAFTED", "EDITED", "APPROVED"].includes(rec.status)) {
    return { ok: false, reason: "not_in_approvable_state", status: 409 };
  }
  const updated = await prisma.nbaRecommendation.update({
    where: { id: rec.id },
    data: { status: "APPROVED", payload: appendAudit(rec.payload, { event: "approved", actor }) },
  });
  return { ok: true, recommendation: updated };
}

/**
 * Execute. Outbound actions require APPROVED (else 403). Idempotent per rec id
 * (re-execute of a SENT action returns the prior engagement id). Internal actions
 * (PREP_MEETING, UPDATE_CRM_CREATE_TASK, CALL_WITH_SCRIPT) execute without the gate.
 */
export async function executeRecommendation({ tenantId, recId, actor = null, surface = "api" }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const runExecutor = deps.runExecutor ?? defaultRunExecutor;
  const rec = await loadRec(prisma, tenantId, recId);
  if (!rec) return { ok: false, reason: "not_found", status: 404 };

  if (rec.status === "SENT") {
    return { ok: true, idempotent: true, hubspotEngagementId: rec.hubspotEngagementId };
  }
  if (OUTBOUND_ACTIONS.has(rec.actionType) && rec.status !== "APPROVED") {
    return { ok: false, reason: "approval_required", status: 403 };
  }

  const draft = rec.payload?.draft ?? defaultDraft(rec);
  const result = await runExecutor(
    { actionType: rec.actionType, tenantId, deal: rec.deal, draft },
    deps.executorDeps
  );

  if (!result.ok) {
    await prisma.nbaRecommendation.update({
      where: { id: rec.id },
      data: {
        status: "FAILED",
        payload: appendAudit(rec.payload, { event: "failed", reason: result.reason, actor, surface }),
      },
    });
    return { ok: false, reason: result.reason, status: 502 };
  }

  const updated = await prisma.nbaRecommendation.update({
    where: { id: rec.id },
    data: {
      status: "SENT",
      executedAt: new Date(),
      hubspotEngagementId: result.engagementId ?? null,
      payload: appendAudit({ ...(rec.payload ?? {}), result }, { event: "executed", actor, surface }),
    },
  });
  return {
    ok: true,
    recommendation: updated,
    hubspotEngagementId: result.engagementId ?? null,
    internal: !!result.internal,
  };
}

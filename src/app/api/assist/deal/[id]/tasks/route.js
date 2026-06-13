import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { createTask } from "@/lib/assist/hubspotWrite";
import { logAssistAction } from "@/lib/assist/logAction";
import { parseGtmStepKey } from "@/lib/assist/gtmTaskbook";

/** GET — list persisted GTM taskbook steps for a deal. */
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId } = await params;
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }

  const tasks = await prisma.dealGtmTask.findMany({
    where: { tenantId: ctx.tenantId, dealId },
    orderBy: [{ pathIndex: "asc" }, { stepIndex: "asc" }],
  });

  return NextResponse.json({ tasks });
}

/**
 * POST { steps: [{ stepKey, subject, body }] } — create one HubSpot task per GTM path
 * step, associate to the deal, and persist completion in DealGtmTask.
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
        .filter(
          (s) =>
            s &&
            typeof s === "object" &&
            typeof s.subject === "string" &&
            s.subject.trim() &&
            typeof s.stepKey === "string" &&
            s.stepKey.trim()
        )
        .map((s) => ({
          stepKey: s.stepKey.trim(),
          subject: s.subject.trim(),
          body: typeof s.body === "string" ? s.body : "",
        }))
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
    const indices = parseGtmStepKey(step.stepKey);
    if (!indices) continue;

    const existing = await prisma.dealGtmTask.findUnique({
      where: { dealId_stepKey: { dealId, stepKey: step.stepKey } },
    });
    if (existing) {
      created.push({
        stepKey: step.stepKey,
        subject: existing.subject,
        id: existing.hubspotTaskId,
        status: existing.status,
        alreadyCreated: true,
      });
      continue;
    }

    const res = await createTask(token, {
      dealId: deal.hubspotDealId,
      subject: step.subject,
      body: step.body,
    });
    if (res.ok) {
      const row = await prisma.dealGtmTask.create({
        data: {
          tenantId: ctx.tenantId,
          dealId,
          stepKey: step.stepKey,
          pathIndex: indices.pathIndex,
          stepIndex: indices.stepIndex,
          subject: step.subject,
          body: step.body || null,
          hubspotTaskId: res.id ?? null,
          status: "created",
        },
      });
      created.push({
        stepKey: step.stepKey,
        subject: step.subject,
        id: res.id,
        status: row.status,
      });
    } else if (res.status === 403) {
      scopeBlocked = true;
      break;
    }
  }

  if (scopeBlocked && !created.length) {
    return NextResponse.json({ ok: false, reason: "write_scope" });
  }

  const newlyCreated = created.filter((c) => !c.alreadyCreated);
  if (newlyCreated.length) {
    await logAssistAction(prisma, {
      tenantId: ctx.tenantId,
      actorUserId: ctx.user?.id ?? null,
      entityType: "deal",
      hsObjectId: deal.hubspotDealId,
      action: "TASK_CREATED",
      payload: {
        subjects: newlyCreated.map((c) => c.subject),
        stepKeys: newlyCreated.map((c) => c.stepKey),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    created,
    ...(scopeBlocked ? { reason: "write_scope", partial: true } : {}),
  });
}

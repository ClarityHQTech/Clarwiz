import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAssistAction } from "@/lib/assist/logAction";
import { assembleCollateralVars, generateCollateral } from "@/lib/assist/collateralGen";

/**
 * POST (COLLATERAL_MANAGE) — generate on-brand sales collateral with Claude.
 *
 * Body: { dealId?, accountId?, nbaId?, title? }
 *
 * Flow: assemble graph vars → Claude → store a Document → register a
 * CollateralIndex row (source GENERATED, type ONE_PAGER) → log COLLATERAL_SENT.
 *
 * Returns { ok, documentId, collateralId, compliance }.
 *
 * Failure modes:
 *   412 — Anthropic key missing or the tenant has no MOFU/HubSpot integration.
 *   502 — the Claude generation itself failed (never a 500 crash).
 */
export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const tenantId = ctx.tenantId;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const dealId = body?.dealId ? String(body.dealId) : null;
  const accountId = body?.accountId ? String(body.accountId) : null;
  const nbaId = body?.nbaId ? String(body.nbaId) : null;
  const titleOverride = typeof body?.title === "string" ? body.title.trim() : "";

  if (!dealId && !accountId && !nbaId) {
    return NextResponse.json({ error: "deal_account_or_nba_required" }, { status: 400 });
  }

  // 412 — prerequisites: an Anthropic key and a connected MOFU/HubSpot integration.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "anthropic_not_configured" }, { status: 412 });
  }
  const integration = await prisma.mofuIntegration.findUnique({
    where: { tenantId },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json({ error: "integration_missing" }, { status: 412 });
  }

  // Build prompt vars from the graph (Tenant / Account+Company / Deal / NBA).
  const { vars, dealHsId, companyHsId } = await assembleCollateralVars(prisma, tenantId, {
    dealId,
    accountId,
    nbaId,
  });

  // Claude call is fenced — any failure becomes a 502, never an unhandled 500.
  let generated;
  try {
    generated = await generateCollateral({ vars });
  } catch (err) {
    console.warn(`[MOFU] collateral generation failed: ${err.message}`);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  const title =
    titleOverride || (generated.title && generated.title.trim()) || "Generated collateral";

  // Store the full generated artifact.
  const document = await prisma.document.create({
    data: {
      tenantId,
      dealHsId,
      companyHsId,
      title,
      template: generated.template || "",
      html: generated.html || "",
      data: generated.data ?? {},
      compliance: generated.compliance ?? null,
      model: generated.model,
      promptVersion: generated.promptVersion,
    },
  });

  // Register it in the directory so it surfaces as best-match collateral.
  const collateral = await prisma.collateralIndex.create({
    data: {
      tenantId,
      title,
      type: "ONE_PAGER",
      source: "GENERATED",
      externalId: document.id,
      companyHsId,
      dealHsId,
    },
  });

  // Link the document back to its index entry (best-effort).
  await prisma.document
    .update({ where: { id: document.id }, data: { collateralId: collateral.id } })
    .catch(() => {});

  await logAssistAction(prisma, {
    tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "collateral",
    hsObjectId: dealHsId || companyHsId || null,
    action: "COLLATERAL_SENT",
    payload: {
      documentId: document.id,
      collateralId: collateral.id,
      complianceScore: generated.compliance?.score ?? null,
      source: "GENERATED",
    },
  });

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    collateralId: collateral.id,
    compliance: generated.compliance,
  });
}

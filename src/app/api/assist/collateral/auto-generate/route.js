import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAssistAction } from "@/lib/assist/logAction";
import {
  assembleCollateralVars,
  generateCollateral,
  storeGeneratedCollateral,
} from "@/lib/assist/collateralGen";

/**
 * POST /api/assist/collateral/auto-generate  (COLLATERAL_MANAGE)
 *
 * Body: { dealId }
 *
 * Powers "on-the-fly collateral from a deal". Idempotent per deal:
 *  - If a GENERATED Document already exists for the deal, return it.
 *  - Otherwise assembleCollateralVars → generateCollateral → store Document +
 *    register CollateralIndex (shared storeGeneratedCollateral helper).
 *
 * Returns { ok, documentId, reused? }.
 *
 * Failure modes:
 *   400 — missing dealId / invalid JSON.
 *   412 — Anthropic key not configured.
 *   404 — deal not found for this tenant.
 *   502 — the Claude generation itself failed (never an unhandled 500).
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
  if (!dealId) {
    return NextResponse.json({ error: "deal_required" }, { status: 400 });
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    select: { id: true, hubspotDealId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Idempotent: reuse a prior GENERATED Document for this deal if one exists.
  // Match on the deal's HubSpot id (how generated docs are tagged) when present,
  // falling back to the internal deal id.
  const existing = await prisma.document.findFirst({
    where: {
      tenantId,
      promptVersion: { not: null },
      OR: [
        deal.hubspotDealId ? { dealHsId: deal.hubspotDealId } : undefined,
        { dealHsId: deal.id },
      ].filter(Boolean),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, documentId: existing.id, reused: true });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "anthropic_not_configured" }, { status: 412 });
  }

  const { vars, dealHsId, companyHsId } = await assembleCollateralVars(prisma, tenantId, {
    dealId,
  });

  let generated;
  try {
    generated = await generateCollateral({ vars });
  } catch (err) {
    console.warn(`[MOFU] collateral auto-generate failed: ${err.message}`);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  const { document, collateral } = await storeGeneratedCollateral(prisma, {
    tenantId,
    generated,
    title: generated.title,
    // Tag with the HubSpot deal id so future auto-generate calls dedupe; fall
    // back to the internal deal id when the deal has no HubSpot mapping yet.
    dealHsId: dealHsId || deal.id,
    companyHsId,
  });

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
      auto: true,
    },
  });

  return NextResponse.json({ ok: true, documentId: document.id });
}

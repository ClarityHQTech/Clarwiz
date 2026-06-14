import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAssistAction } from "@/lib/assist/logAction";
import { editCollateral } from "@/lib/assist/collateralGen";

/**
 * POST /api/assist/document/[id]/edit  (COLLATERAL_MANAGE)
 *
 * Body: { instruction }
 *
 * Applies a chat instruction to the stored collateral with Claude:
 *  1. load the tenant-scoped Document
 *  2. snapshot the current {template, html, instruction, at} into `versions`
 *  3. call editCollateral → updated {template, html, compliance}
 *  4. persist the new template/html/compliance (+ the grown versions array)
 *  5. logAssistAction(COLLATERAL_SENT)
 *
 * Returns { ok, html, compliance, versionCount }.
 *
 * Failure modes:
 *   412 — Anthropic key not configured.
 *   400 — missing instruction / invalid JSON.
 *   404 — document not found for this tenant.
 *   502 — the Claude edit itself failed (never an unhandled 500).
 */
export async function POST(request, { params }) {
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

  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (!instruction) {
    return NextResponse.json({ error: "instruction_required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "anthropic_not_configured" }, { status: 412 });
  }

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId },
  });
  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { isPredefinedDocument } = await import("@/lib/assist/richCollateral/predefinedTemplates");
  const docData = document.data && typeof document.data === "object" ? document.data : {};
  if (isPredefinedDocument(docData)) {
    return NextResponse.json({ error: "predefined_read_only" }, { status: 403 });
  }

  // The doc model (Document.data) is the source of truth we patch.
  const currentDoc = docData;

  // Claude edit is fenced — any failure becomes a 502, never an unhandled 500.
  let edited;
  try {
    edited = await editCollateral({ currentDoc, instruction });
  } catch (err) {
    console.warn(`[MOFU] collateral edit failed: ${err.message}`);
    return NextResponse.json({ error: "edit_failed" }, { status: 502 });
  }

  // Snapshot the pre-edit artifacts (incl. the prior doc model) into history.
  const priorVersions = Array.isArray(document.versions) ? document.versions : [];
  const versions = [
    ...priorVersions,
    {
      data: currentDoc,
      template: document.template || "",
      html: document.html || "",
      instruction,
      at: new Date().toISOString(),
    },
  ];

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: {
      data: edited.data ?? currentDoc,
      template: edited.template || document.template || "",
      html: edited.html || document.html || "",
      compliance: edited.compliance ?? document.compliance ?? null,
      versions,
    },
    select: { html: true, template: true, compliance: true, versions: true },
  });

  await logAssistAction(prisma, {
    tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "collateral",
    hsObjectId: document.dealHsId || document.companyHsId || null,
    action: "COLLATERAL_SENT",
    payload: {
      documentId: document.id,
      edit: true,
      instruction,
      complianceScore: edited.compliance?.score ?? null,
      versionCount: versions.length,
    },
    modelUsed: edited.modelUsed ?? edited.model ?? null,
    providerUsage: edited.providerUsage ?? null,
    providerCost: edited.providerCost ?? null,
  });

  return NextResponse.json({
    ok: true,
    html: updated.html,
    compliance: updated.compliance,
    versionCount: Array.isArray(updated.versions) ? updated.versions.length : versions.length,
  });
}

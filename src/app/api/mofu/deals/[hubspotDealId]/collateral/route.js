import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { generateCollateral } from "@/lib/mofu/collateral/engine";
import { loadDealOntology } from "@/lib/mofu/templates";
import { listDealDocuments } from "@/lib/mofu/documents";

// GET — list this deal's collateral documents.
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const deal = await prisma.deal.findUnique({
    where: { tenantId_hubspotDealId: { tenantId: auth.ctx.tenantId, hubspotDealId: params.hubspotDealId } },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  const documents = await listDealDocuments({ tenantId: auth.ctx.tenantId, dealId: deal.id });
  return NextResponse.json({ dealId: deal.id, documents });
}

// POST { templateId, category } — generate collateral from a template + the deal ontology.
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_GENERATE });
  if (auth.error) return auth.error;
  const deal = await prisma.deal.findUnique({
    where: { tenantId_hubspotDealId: { tenantId: auth.ctx.tenantId, hubspotDealId: params.hubspotDealId } },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* defaults */
  }
  const context = await loadDealOntology({ tenantId: auth.ctx.tenantId, dealId: deal.id });
  const out = await generateCollateral({
    tenantId: auth.ctx.tenantId,
    dealId: deal.id,
    templateId: body.templateId ?? "builtin:one_pager",
    category: body.category ?? "marketing",
    context,
  });
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json(out, { status: 201 });
}

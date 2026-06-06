import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { regenerateCollateral } from "@/lib/mofu/collateral/engine";
import { loadDealOntology } from "@/lib/mofu/templates";

// POST /api/mofu/documents/:id/enrich { message } — conversational re-enrichment (on the fly).
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_GENERATE });
  if (auth.error) return auth.error;
  const doc = await prisma.document.findFirst({ where: { id: params.id, tenantId: auth.ctx.tenantId } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  const context = await loadDealOntology({ tenantId: auth.ctx.tenantId, dealId: doc.dealId });
  const out = await regenerateCollateral(doc.id, { message: body.message ?? "", context });
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json({ ok: true });
}

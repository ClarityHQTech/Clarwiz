import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { reEnrichSalesCollateral } from "@/lib/mofu/collateral/pathB";

// POST /api/mofu/documents/:id/enrich  { message } — conversational re-enrichment (Path B).
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
  const out = await reEnrichSalesCollateral(params.id, body.message ?? "", {});
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json({ ok: true });
}

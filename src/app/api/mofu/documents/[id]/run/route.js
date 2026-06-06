import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { runPathBPipeline } from "@/lib/mofu/collateral/pathB";

// POST /api/mofu/documents/:id/run — run the queued Path B pipeline now.
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_GENERATE });
  if (auth.error) return auth.error;
  const doc = await prisma.document.findFirst({ where: { id: params.id, tenantId: auth.ctx.tenantId } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const out = await runPathBPipeline(params.id);
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json({ ok: true });
}

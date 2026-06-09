import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/assist/document/[id] — the stored, tenant-scoped Document so the UI
 * can preview the generated `template` / `data` / `compliance`.
 */
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ document });
}

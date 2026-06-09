import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCompanyView } from "@/lib/assist/insightsReader";

/**
 * GET /api/assist/account/[id]/view — the company-drawer view model
 * (company brief + latest insight + signals + deals + contacts), tenant-scoped.
 */
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const view = await getCompanyView(prisma, ctx.tenantId, id);
  if (!view) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ view });
}

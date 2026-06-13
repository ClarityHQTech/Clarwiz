import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getContactView } from "@/lib/assist/insightsReader";

/**
 * GET /api/assist/contact/[id]/view — contact drawer view model (profile, company, NBAs).
 * Optional ?dealId= scopes deal-stakeholder role on this contact.
 */
export async function GET(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const dealId = new URL(request.url).searchParams.get("dealId");

  const view = await getContactView(prisma, ctx.tenantId, id, { dealId });
  if (!view) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ view });
}

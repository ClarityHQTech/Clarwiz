import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getDealInsights } from "@/lib/mofu/insightsReader";

// GET /api/mofu/deals/:hubspotDealId/insights — Heptapod bundle + signals + gated NBA cards.
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.DEAL_READ });
  if (auth.error) return auth.error;

  const out = await getDealInsights({
    tenantId: auth.ctx.tenantId,
    hubspotDealId: params.hubspotDealId,
  });
  if (!out.ok) return NextResponse.json(out, { status: 404 });
  return NextResponse.json(out);
}

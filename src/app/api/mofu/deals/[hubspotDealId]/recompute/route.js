import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { recomputeDeal } from "@/lib/mofu/recompute";

// POST /api/mofu/deals/:hubspotDealId/recompute — "suggest now": hydrate -> bundle -> NBA.
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_RUN });
  if (auth.error) return auth.error;

  const out = await recomputeDeal({
    tenantId: auth.ctx.tenantId,
    hubspotDealId: params.hubspotDealId,
  });

  if (!out.ok && out.reason === "sor_not_connected") {
    return NextResponse.json({ ...out, cta: "connect_hubspot" }, { status: 409 });
  }
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json(out);
}

import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { hydrateDeal } from "@/lib/mofu/hydrateDeal";

// POST /api/mofu/deals/:hubspotDealId/hydrate — hybrid hydrate for the active tenant.
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.DEAL_READ });
  if (auth.error) return auth.error;

  const out = await hydrateDeal({
    tenantId: auth.ctx.tenantId,
    hubspotDealId: params.hubspotDealId,
  });

  if (!out.ok && out.reason === "sor_not_connected") {
    return NextResponse.json({ ...out, cta: "connect_hubspot" }, { status: 409 });
  }
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json(out);
}

import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { syncDealsFromHubSpot } from "@/lib/mofu/syncDeals";

// POST /api/mofu/deals/sync — pull deals from HubSpot and hydrate them.
export async function POST() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.DEAL_READ });
  if (auth.error) return auth.error;
  const out = await syncDealsFromHubSpot({ tenantId: auth.ctx.tenantId, limit: 50 });
  if (!out.ok && out.reason === "sor_not_connected") {
    return NextResponse.json({ ...out, cta: "connect_hubspot" }, { status: 409 });
  }
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json(out);
}

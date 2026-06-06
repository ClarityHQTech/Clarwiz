import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getOperatorDashboard, getMofuDeals } from "@/lib/mofu/operator";

// GET /api/mofu/operator — operator dashboard stats + deals list.
export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const [dashboard, deals] = await Promise.all([
    getOperatorDashboard({ tenantId: auth.ctx.tenantId }),
    getMofuDeals({ tenantId: auth.ctx.tenantId }),
  ]);
  return NextResponse.json({ ...dashboard, deals });
}

import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getOperatorDashboard, getMofuDeals, getActivityFeed } from "@/lib/mofu/operator";

// GET /api/mofu/operator — operator dashboard stats + deals list + activity feed.
export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const [dashboard, deals, feed] = await Promise.all([
    getOperatorDashboard({ tenantId: auth.ctx.tenantId }),
    getMofuDeals({ tenantId: auth.ctx.tenantId }),
    getActivityFeed({ tenantId: auth.ctx.tenantId }),
  ]);
  return NextResponse.json({ ...dashboard, deals, feed });
}

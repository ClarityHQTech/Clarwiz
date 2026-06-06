import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { approveRecommendation } from "@/lib/mofu/execution/rails";

// POST /api/mofu/recommendations/:id/approve — mandatory approve gate (nba:approve).
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_APPROVE });
  if (auth.error) return auth.error;
  const out = await approveRecommendation({
    tenantId: auth.ctx.tenantId,
    recId: params.id,
    actor: auth.ctx.user?.email ?? auth.ctx.user?.id ?? null,
  });
  if (!out.ok) return NextResponse.json(out, { status: out.status ?? 400 });
  return NextResponse.json(out);
}

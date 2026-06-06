import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { executeRecommendation } from "@/lib/mofu/execution/rails";

// POST /api/mofu/recommendations/:id/execute — send via HubSpot (approve gate enforced inside).
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_APPROVE });
  if (auth.error) return auth.error;
  const out = await executeRecommendation({
    tenantId: auth.ctx.tenantId,
    recId: params.id,
    actor: auth.ctx.user?.email ?? auth.ctx.user?.id ?? null,
    surface: "api",
  });
  if (!out.ok) return NextResponse.json(out, { status: out.status ?? 400 });
  return NextResponse.json(out);
}

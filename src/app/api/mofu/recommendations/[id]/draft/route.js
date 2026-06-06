import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { draftRecommendation } from "@/lib/mofu/execution/rails";

// POST /api/mofu/recommendations/:id/draft  { edits? } — generate or save an edited draft.
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_RUN });
  if (auth.error) return auth.error;
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body allowed */
  }
  const out = await draftRecommendation({
    tenantId: auth.ctx.tenantId,
    recId: params.id,
    edits: body?.edits ?? null,
  });
  if (!out.ok) return NextResponse.json(out, { status: out.status ?? 400 });
  return NextResponse.json(out);
}

import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getDocument } from "@/lib/mofu/documents";

export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const out = await getDocument({ tenantId: auth.ctx.tenantId, documentId: params.id });
  if (!out.ok) return NextResponse.json(out, { status: 404 });
  return NextResponse.json(out);
}

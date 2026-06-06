import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteTemplate } from "@/lib/mofu/templates";

export async function DELETE(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_GENERATE });
  if (auth.error) return auth.error;
  await deleteTemplate({ tenantId: auth.ctx.tenantId, id: params.id });
  return NextResponse.json({ ok: true });
}

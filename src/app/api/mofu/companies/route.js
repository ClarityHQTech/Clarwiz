import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getTenantCompanies } from "@/lib/mofu/directory";

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const companies = await getTenantCompanies({ tenantId: auth.ctx.tenantId });
  return NextResponse.json({ companies });
}

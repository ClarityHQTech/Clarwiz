import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getTenantContacts } from "@/lib/mofu/directory";

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const contacts = await getTenantContacts({ tenantId: auth.ctx.tenantId });
  return NextResponse.json({ contacts });
}

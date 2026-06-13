import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCrmEmailCapabilities } from "@/lib/assist/crmEmailCapabilities";

/** GET — whether AE Assist CRM email can be sent for the current user/tenant. */
export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const capabilities = await getCrmEmailCapabilities(prisma, ctx.tenantId, ctx.user?.id ?? null);
  return NextResponse.json({ capabilities });
}

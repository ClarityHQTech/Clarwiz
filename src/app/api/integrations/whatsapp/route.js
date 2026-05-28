import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWhatsAppIntegration } from "@/lib/whatsappIntegration";

export async function GET(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const integration = await getWhatsAppIntegration(ctx.tenantId, { refresh });

  return NextResponse.json({ integration });
}

export async function DELETE() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  await prisma.whatsAppIntegration.deleteMany({ where: { tenantId: ctx.tenantId } });

  return NextResponse.json({ success: true });
}

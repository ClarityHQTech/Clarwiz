import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getLinkedInIntegration } from "@/lib/linkedinIntegration";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const integration = await getLinkedInIntegration(ctx.tenantId);
  return NextResponse.json({ integration });
}

export async function DELETE() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  await prisma.linkedInIntegration.deleteMany({
    where: { tenantId: ctx.tenantId },
  });

  return NextResponse.json({ success: true });
}

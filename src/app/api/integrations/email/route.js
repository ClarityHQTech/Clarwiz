import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmailIntegration } from "@/lib/emailIntegration";
import { deleteEmailAccount } from "@/lib/smartleadApi";
import { decryptSmartleadAccountId } from "@/lib/encryptSecret";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const integration = await getEmailIntegration(ctx.tenantId, { refresh });

  return NextResponse.json({ integration });
}

export async function DELETE() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const record = await prisma.emailIntegration.findUnique({
    where: { tenantId: ctx.tenantId },
    include: { inboxes: true },
  });

  if (!record) {
    return NextResponse.json({ success: true });
  }

  for (const inbox of record.inboxes) {
    if (!inbox.encryptedSmartleadAccountId) continue;
    try {
      const accountId = decryptSmartleadAccountId(inbox.encryptedSmartleadAccountId);
      if (accountId) {
        await deleteEmailAccount(accountId);
      }
    } catch {
      // Still remove local records if Smartlead delete fails
    }
  }

  await prisma.emailIntegration.deleteMany({ where: { tenantId: ctx.tenantId } });

  return NextResponse.json({ success: true });
}

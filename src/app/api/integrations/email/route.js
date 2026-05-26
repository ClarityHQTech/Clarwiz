import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import {
  getDecryptedSmartleadAccountId,
  getEmailIntegration,
} from "@/lib/emailIntegration";
import { deleteEmailAccount } from "@/lib/smartleadApi";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const integration = await getEmailIntegration(user.id, { refresh });

  return NextResponse.json({ integration });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  });

  if (record?.encryptedSmartleadAccountId && record.mode === "smartlead_inbox") {
    try {
      const accountId = await getDecryptedSmartleadAccountId(user.id);
      if (accountId) {
        await deleteEmailAccount(accountId);
      }
    } catch {
      // Still remove local record if Smartlead delete fails
    }
  }

  await prisma.emailIntegration.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ success: true });
}

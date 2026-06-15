import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getSmartleadInboxForTenant,
  serializeEmailIntegration,
} from "@/lib/emailIntegration";
import { deleteEmailAccount } from "@/lib/smartleadApi";
import { decryptSmartleadAccountId } from "@/lib/encryptSecret";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const inbox = await getSmartleadInboxForTenant(ctx.tenantId, params.inboxId);
  if (!inbox) {
    return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
  }

  try {
    const accountId = decryptSmartleadAccountId(inbox.encryptedSmartleadAccountId);
    if (accountId) {
      await deleteEmailAccount(accountId);
    }
  } catch {
    // Still remove local record if Smartlead delete fails
  }

  const parent = await prisma.emailIntegration.findUnique({
    where: { tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!parent) {
    return NextResponse.json({ error: "Email integration not found" }, { status: 404 });
  }

  await prisma.smartleadInbox.delete({ where: { id: inbox.id } });

  const remaining = await prisma.smartleadInbox.findMany({
    where: { emailIntegrationId: parent.id },
    orderBy: { createdAt: "asc" },
  });

  if (!remaining.length) {
    await prisma.emailIntegration.delete({ where: { id: parent.id } });
    return NextResponse.json({ integration: null, success: true });
  }

  const primary =
    remaining.find((item) => item.status === "connected") ?? remaining[0];

  const record = await prisma.emailIntegration.update({
    where: { id: parent.id },
    data: {
      status: remaining.some((item) => item.status === "connected")
        ? "connected"
        : remaining.some((item) => item.status === "failed")
          ? "failed"
          : "pending",
      fromEmail: primary.fromEmail,
      fromName: primary.fromName,
      sendingDomain: primary.sendingDomain,
      providerType: primary.providerType,
      encryptedSmartleadAccountId: primary.encryptedSmartleadAccountId,
      isSmtpSuccess: primary.isSmtpSuccess,
      isImapSuccess: primary.isImapSuccess,
      warmupEnabled: primary.warmupEnabled,
      warmupStatus: primary.warmupStatus,
      warmupReputation: primary.warmupReputation,
      connectedAt: primary.connectedAt,
    },
    include: { inboxes: { orderBy: { createdAt: "asc" } } },
  });

  const campaigns = await prisma.campaign.findMany({
    where: {
      tenantId: ctx.tenantId,
      smartleadInboxIds: { has: inbox.id },
    },
    select: { id: true, smartleadInboxIds: true },
  });

  for (const campaign of campaigns) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        smartleadInboxIds: campaign.smartleadInboxIds.filter((id) => id !== inbox.id),
      },
    });
  }

  return NextResponse.json({
    success: true,
    integration: serializeEmailIntegration(record),
  });
}

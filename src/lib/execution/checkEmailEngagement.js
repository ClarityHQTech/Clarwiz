import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import {
  applyEngagementToCommLog,
  fetchSmartleadEngagementForProspect,
  resolveSmartleadDeliveryStatus,
} from "@/lib/smartleadOutreach";
import { getDecryptedSmartleadAccountId } from "@/lib/emailIntegration";
import { runExecutionForCampaign } from "@/lib/execution/runCampaignExecution";
import { syncCampaignContactStatus } from "@/lib/syncCampaignContactStatus";

export async function checkEmailEngagementForProspect({
  campaignId,
  prospectId,
  tenantId,
}) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    select: {
      id: true,
      tenantId: true,
      smartleadCampaignId: true,
    },
  });
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const cc = await prisma.campaignContact.findFirst({
    where: { id: prospectId, campaignId },
    include: { contact: { include: { businessUser: true } } },
  });
  if (!cc) {
    throw new Error("Contact not found");
  }
  const prospect = {
    id: cc.id,
    email: cc.contact.businessUser.email,
  };
  if (!prospect.email?.trim()) {
    throw new Error("Contact has no email address");
  }

  const pendingLog = await prisma.communicationLog.findFirst({
    where: {
      campaignId,
      campaignContactId: prospectId,
      channel: "email",
      responseType: null,
      status: { in: ["planned", "queued", "sent", "delivered"] },
    },
    orderBy: { sentAt: "desc" },
  });

  if (!pendingLog) {
    return {
      activity: null,
      message: "No Smartlead email awaiting tracking for this prospect",
      ranExecution: false,
    };
  }

  let logForEngagement = pendingLog;

  if (
    (pendingLog.status === "queued" || pendingLog.status === "sent") &&
    campaign.smartleadCampaignId &&
    prospect.email
  ) {
    const emailAccountId = await getDecryptedSmartleadAccountId(tenantId);
    const resolved = await resolveSmartleadDeliveryStatus({
      smartleadCampaignId: campaign.smartleadCampaignId,
      leadEmail: prospect.email,
      emailAccountId: emailAccountId ? Number(emailAccountId) : undefined,
      waitMs: 0,
    });

    if (resolved.status !== pendingLog.status) {
      logForEngagement = await prisma.communicationLog.update({
        where: { id: pendingLog.id },
        data: {
          status: resolved.status,
          deliveryMeta: {
            ...(pendingLog.deliveryMeta &&
            typeof pendingLog.deliveryMeta === "object"
              ? pendingLog.deliveryMeta
              : {}),
            ...resolved.deliveryMeta,
            deliveryMessage: resolved.message,
          },
        },
      });
      if (resolved.status === "sent" || resolved.status === "delivered") {
        await syncCampaignContactStatus(prisma, prospectId);
      }
    }
  }

  const { engagement, source } = await fetchSmartleadEngagementForProspect({
    tenantId,
    prospectEmail: prospect.email,
    smartleadCampaignId: campaign.smartleadCampaignId,
  });

  if (!engagement?.activity) {
    const deliveryNote =
      logForEngagement.status === "queued"
        ? logForEngagement.deliveryMeta?.deliveryMessage ||
          "Still queued in Smartlead — not in sent mail yet."
        : "No opens or replies yet";
    return {
      activity: null,
      emailStatus: engagement?.emailStatus ?? null,
      source,
      commLogId: logForEngagement.id,
      deliveryStatus: logForEngagement.status,
      message: deliveryNote,
      ranExecution: false,
    };
  }

  const { updated, log, activity } = await applyEngagementToCommLog(
    logForEngagement,
    engagement
  );

  if (!updated) {
    return {
      activity: null,
      commLogId: pendingLog.id,
      message: "Engagement already recorded",
      ranExecution: false,
    };
  }

  await syncCampaignMetrics(prisma, campaignId);

  let execution = null;
  if (activity === "reply") {
    execution = await runExecutionForCampaign(campaignId, {
      prospectIds: [prospectId],
      skipDailyLimit: true,
    });
  }

  return {
    activity,
    emailStatus: engagement.emailStatus,
    source,
    commLogId: log.id,
    responseContent: log.responseContent,
    openedAt: log.openedAt?.toISOString?.() ?? null,
    ranExecution: Boolean(execution),
    execution,
  };
}

import { prisma } from "@/lib/prisma";
import {
  engagementFromMetaMessageStatus,
  getWhatsAppMessageStatus,
} from "@/lib/metaWhatsAppApi";
import {
  getDecryptedAccessToken,
  getWhatsAppIntegration,
} from "@/lib/whatsappIntegration";
import { applyWhatsAppEngagement } from "@/lib/execution/applyChannelEngagement";

function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

/**
 * Poll Meta Cloud API for template message delivery/read status.
 */
export async function checkWhatsAppEngagementForCampaign({
  tenantId,
  prospects,
  pendingLogsByProspect,
}) {
  const integration = await getWhatsAppIntegration(tenantId);
  if (!integration || integration.status !== "connected") {
    return { results: [], skipped: true, reason: "whatsapp_not_connected" };
  }

  if (integration.mode === "interakt") {
    return {
      results: [],
      skipped: true,
      reason: "interakt_requires_webhook",
      message:
        "Interakt delivery status is updated via webhook; configure webhook URL in Interakt.",
    };
  }

  if (integration.mode !== "meta") {
    return { results: [], skipped: true, reason: "whatsapp_mode_unsupported" };
  }

  const accessToken = await getDecryptedAccessToken(tenantId);
  if (!accessToken) {
    return { results: [], skipped: true, reason: "whatsapp_token_missing" };
  }

  const results = [];

  for (const prospect of prospects) {
    const pending = (pendingLogsByProspect.get(prospect.id) ?? []).filter(
      (l) => l.channel === "whatsapp" && !l.responseType
    );
    if (!pending.length) continue;

    for (const log of pending) {
      const messageId =
        log.deliveryMeta?.messageId ?? log.deliveryMeta?.wamid ?? null;
      if (!messageId) continue;

      try {
        const statusData = await getWhatsAppMessageStatus(
          messageId,
          accessToken
        );
        const mapped = engagementFromMetaMessageStatus(statusData);
        if (!mapped?.activity || mapped.activity === "sent") continue;

        const { updated, activity } = await applyWhatsAppEngagement(log, {
          activity: mapped.activity,
          provider: "meta",
          deliveryMeta: { messageStatus: statusData?.status ?? null },
          deliveredAt:
            mapped.activity === "delivered" ? new Date().toISOString() : null,
          readAt: mapped.activity === "read" ? new Date().toISOString() : null,
        });

        if (updated) {
          results.push({
            prospectId: prospect.id,
            channel: "whatsapp",
            activity,
            commLogId: log.id,
          });
        }
      } catch (err) {
        results.push({
          prospectId: prospect.id,
          channel: "whatsapp",
          activity: null,
          commLogId: log.id,
          error: err.message,
        });
      }
    }
  }

  return { results, skipped: false };
}

/**
 * Apply WhatsApp webhook payload to a comm log (Meta or Interakt).
 */
export async function applyWhatsAppWebhookToCommLog(commLogId, engagement) {
  const log = await prisma.communicationLog.findUnique({
    where: { id: commLogId },
  });
  if (!log || log.channel !== "whatsapp") return { updated: false, log: null };

  return applyWhatsAppEngagement(log, engagement);
}

/**
 * Find comm log by Meta WAMID or Interakt message id.
 */
export async function findWhatsAppCommLogByMessageId(tenantId, messageId) {
  if (!messageId) return null;

  const logs = await prisma.communicationLog.findMany({
    where: {
      tenantId,
      channel: "whatsapp",
      status: { in: ["planned", "queued", "sent", "delivered"] },
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });

  return (
    logs.find((l) => {
      const meta = l.deliveryMeta;
      if (!meta || typeof meta !== "object") return false;
      return meta.messageId === messageId || meta.wamid === messageId;
    }) ?? null
  );
}

/**
 * Find comm log by prospect phone for inbound messages.
 */
export async function findWhatsAppCommLogByPhone({
  tenantId,
  campaignId,
  phone,
}) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const rows = await prisma.contactCampaign.findMany({
    where: campaignId
      ? { campaignId }
      : { campaign: { tenantId } },
    include: { contact: { include: { businessUser: true } } },
  });

  const match = rows.find((cc) => {
    const bu = cc.contact.businessUser;
    const pPhone = normalizePhone(bu.whatsapp || bu.phone);
    return pPhone && (pPhone === normalized || pPhone.endsWith(normalized.slice(-10)));
  });
  if (!match) return null;

  return prisma.communicationLog.findFirst({
    where: {
      tenantId,
      contactCampaignId: match.id,
      campaignId: campaignId ?? match.campaignId,
      channel: "whatsapp",
      responseType: null,
    },
    orderBy: { sentAt: "desc" },
  });
}

export { normalizePhone };

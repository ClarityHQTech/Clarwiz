import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { applyWhatsAppEngagement } from "@/lib/execution/applyChannelEngagement";
import {
  findWhatsAppCommLogByMessageId,
  findWhatsAppCommLogByPhone,
  normalizePhone,
} from "@/lib/execution/checkWhatsAppEngagement";
import {
  parseInteraktInboundWebhook,
  parseMetaInboundWebhook,
  recordWhatsAppInboundMessage,
} from "@/lib/execution/whatsappInboundMessage";

function parseCallbackData(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    if (String(raw).includes("commLogId")) {
      try {
        return JSON.parse(String(raw).replace(/'/g, '"'));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function resolveCommLog({ userId, commLogId, messageId, phone, campaignId }) {
  if (commLogId) {
    const log = await prisma.communicationLog.findFirst({
      where: { id: commLogId, userId, channel: "whatsapp" },
    });
    if (log) return log;
  }

  if (messageId) {
    const byMsg = await findWhatsAppCommLogByMessageId(userId, messageId);
    if (byMsg) return byMsg;
  }

  if (phone) {
    return findWhatsAppCommLogByPhone({ userId, campaignId, phone });
  }

  return null;
}

async function afterStatusUpdate(log, activity) {
  if (!log?.campaignId) return;
  await syncCampaignMetrics(prisma, log.campaignId);
}

/**
 * Handle Meta WhatsApp Cloud API webhook payload.
 */
export async function handleMetaWhatsAppWebhook(userId, body) {
  const processed = [];

  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value) continue;

      for (const status of value.statuses ?? []) {
        const messageId = status.id;
        const commLogId = parseCallbackData(
          status.biz_opaque_callback_data
        )?.commLogId;

        const log = await resolveCommLog({
          userId,
          commLogId,
          messageId,
          phone: status.recipient_id,
        });
        if (!log) continue;

        const s = String(status.status ?? "").toLowerCase();
        let activity = null;
        if (s === "read") activity = "read";
        else if (s === "delivered") activity = "delivered";
        else if (s === "failed") activity = "failed";

        if (!activity) continue;

        const { updated, activity: applied } = await applyWhatsAppEngagement(
          log,
          {
            activity,
            provider: "meta",
            deliveryMeta: { messageStatus: s, messageId },
            readAt: s === "read" ? new Date().toISOString() : null,
            deliveredAt:
              s === "delivered" ? new Date().toISOString() : null,
          }
        );

        if (updated) {
          await afterStatusUpdate(log, applied);
          processed.push({ commLogId: log.id, activity: applied });
        }
      }
    }
  }

  const inboundEvents = parseMetaInboundWebhook(body);
  for (const event of inboundEvents) {
    const result = await recordWhatsAppInboundMessage({
      userId,
      provider: "meta",
      phone: event.phone,
      text: event.text,
      inboundMessageId: event.inboundMessageId,
      contextMessageId: event.contextMessageId,
      repliedAt: event.repliedAt,
      messageType: event.messageType,
      triggerExecution: true,
    });

    if (result.stored) {
      processed.push({
        commLogId: result.commLogId,
        activity: "reply",
        prospectId: result.prospectId,
        ranExecution: result.ranExecution,
      });
    } else if (result.reason !== "duplicate") {
      processed.push({
        activity: "reply_skipped",
        reason: result.reason,
        phone: result.phone,
      });
    }
  }

  return processed;
}

/**
 * Handle Interakt webhook payload (template status + incoming messages).
 */
export async function handleInteraktWhatsAppWebhook(userId, body) {
  const processed = [];

  const inbound = parseInteraktInboundWebhook(body);
  if (inbound?.text) {
    const result = await recordWhatsAppInboundMessage({
      userId,
      provider: "interakt",
      phone: inbound.phone,
      text: inbound.text,
      inboundMessageId: inbound.inboundMessageId,
      commLogId: inbound.commLogId,
      campaignId: inbound.campaignId,
      repliedAt: inbound.repliedAt,
      messageType: inbound.messageType,
      triggerExecution: true,
    });

    if (result.stored) {
      return [
        {
          commLogId: result.commLogId,
          activity: "reply",
          prospectId: result.prospectId,
          ranExecution: result.ranExecution,
        },
      ];
    }

    if (result.reason === "duplicate") {
      return [{ activity: "reply", reason: "duplicate", commLogId: result.commLogId }];
    }
  }

  const data = body?.data ?? body;
  const type = body?.type ?? data?.type ?? body?.event ?? "";

  const messageId =
    data?.message_id ??
    data?.messageId ??
    data?.id ??
    body?.message_id ??
    null;

  const callbackRaw =
    data?.callback_data ??
    data?.callbackData ??
    body?.callback_data ??
    null;
  const callback = parseCallbackData(callbackRaw);
  const commLogId = callback?.commLogId;

  const phone =
    data?.phone_number ??
    data?.phoneNumber ??
    data?.customer?.channel_phone_number ??
    data?.customer?.phone_number ??
    body?.phone_number;

  const status =
    data?.status ??
    data?.message_status ??
    body?.status ??
    type;

  const statusNorm = String(status ?? "").toLowerCase();

  if (
    statusNorm.includes("delivered") ||
    statusNorm.includes("read") ||
    statusNorm.includes("sent") ||
    statusNorm.includes("failed")
  ) {
    const log = await resolveCommLog({
      userId,
      commLogId,
      messageId,
      phone: phone ? normalizePhone(phone) : null,
      campaignId: callback?.campaignId,
    });

    if (log) {
      let activity = null;
      if (statusNorm.includes("read")) activity = "read";
      else if (statusNorm.includes("delivered")) activity = "delivered";
      else if (statusNorm.includes("failed")) activity = "failed";

      if (activity && activity !== "sent") {
        const { updated, activity: applied } = await applyWhatsAppEngagement(
          log,
          {
            activity,
            provider: "interakt",
            deliveryMeta: { messageStatus: statusNorm, messageId },
            readAt: activity === "read" ? new Date().toISOString() : null,
            deliveredAt:
              activity === "delivered" ? new Date().toISOString() : null,
          }
        );
        if (updated) {
          await afterStatusUpdate(log, applied);
          processed.push({ commLogId: log.id, activity: applied });
        }
      }
    }
  }

  return processed;
}

/**
 * Resolve userId from Meta phone_number_id in webhook metadata.
 */
export async function resolveWhatsAppWebhookUserId({ phoneNumberId }) {
  if (phoneNumberId) {
    const integration = await prisma.whatsAppIntegration.findFirst({
      where: { phoneNumberId, status: "connected" },
      select: { userId: true },
    });
    if (integration) return integration.userId;
  }

  const envUserId = process.env.WHATSAPP_WEBHOOK_DEFAULT_USER_ID?.trim();
  return envUserId || null;
}

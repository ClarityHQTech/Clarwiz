import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import {
  findWhatsAppCommLogByMessageId,
  normalizePhone,
} from "@/lib/execution/checkWhatsAppEngagement";
import { runExecutionForCampaign } from "@/lib/execution/runCampaignExecution";
import { runPostTrackQualification } from "@/lib/execution/qualifyProspect";
import { shouldAutoExecuteOnWebhook } from "@/lib/execution/webhookAutoExecute";
import { computeWhatsAppWindowExpiry } from "@/lib/whatsappSessionWindow";
import { syncCampaignContactStatus } from "@/lib/syncCampaignContactStatus";

/** Match two phone numbers (full or last 10 digits). */
export function phonesMatch(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 10 && nb.length >= 10) {
    return na.slice(-10) === nb.slice(-10);
  }
  return na.endsWith(nb) || nb.endsWith(na);
}

/**
 * Find a prospect for this tenant by WhatsApp / phone number.
 */
export async function findProspectByWhatsAppPhone(tenantId, phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const rows = await prisma.campaignContact.findMany({
    where: { campaign: { tenantId } },
    include: {
      contact: { include: { businessUser: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const match = rows.find((cc) => {
    const bu = cc.contact.businessUser;
    return phonesMatch(bu.whatsapp || bu.phone, normalized);
  });
  if (!match) return null;

  const bu = match.contact.businessUser;
  return {
    id: match.id,
    name: bu.name,
    phone: bu.phone,
    whatsapp: bu.whatsapp,
    campaignId: match.campaignId,
  };
}

/**
 * Latest WhatsApp comm log for a prospect (prefer awaiting reply).
 */
export async function findWhatsAppCommLogForProspect({
  tenantId,
  prospectId,
  campaignId,
  preferWithoutResponse = true,
}) {
  const baseWhere = {
    tenantId,
    campaignContactId: prospectId,
    channel: "whatsapp",
    ...(campaignId ? { campaignId } : {}),
  };

  if (preferWithoutResponse) {
    const pending = await prisma.communicationLog.findFirst({
      where: { ...baseWhere, responseType: null },
      orderBy: { sentAt: "desc" },
    });
    if (pending) return pending;
  }

  return prisma.communicationLog.findFirst({
    where: baseWhere,
    orderBy: { sentAt: "desc" },
  });
}

function mergeDeliveryMeta(log, patch) {
  return {
    ...(log.deliveryMeta && typeof log.deliveryMeta === "object"
      ? log.deliveryMeta
      : {}),
    ...patch,
    lastTrackedAt: new Date().toISOString(),
  };
}

function alreadyProcessedInbound(log, inboundMessageId) {
  if (!inboundMessageId) return false;
  const meta = log.deliveryMeta;
  if (!meta || typeof meta !== "object") return false;
  if (meta.lastInboundMessageId === inboundMessageId) return true;
  const ids = meta.processedInboundIds;
  return Array.isArray(ids) && ids.includes(inboundMessageId);
}

async function refreshWhatsAppSessionWindow(campaignContactId, repliedAtDate) {
  const expiresAt = computeWhatsAppWindowExpiry(repliedAtDate);
  await prisma.campaignContact.update({
    where: { id: campaignContactId },
    data: { whatsapp24hWindowExpiresAt: expiresAt },
  });
  return expiresAt;
}

async function createInboundOnlyCommLog({
  tenantId,
  campaignContactId,
  campaignId,
  provider,
  trimmedText,
  inboundMessageId,
  repliedAtDate,
  messageType,
}) {
  const processedIds = inboundMessageId ? [inboundMessageId] : [];

  return prisma.communicationLog.create({
    data: {
      tenantId,
      campaignId,
      campaignContactId,
      channel: "whatsapp",
      message: "",
      status: "delivered",
      responseType: "reply",
      responseAt: repliedAtDate,
      responseContent: trimmedText,
      decisionReason: "Inbound WhatsApp message",
      deliveryProvider: provider ?? "meta",
      deliveryMeta: {
        inboundOnly: true,
        lastInboundMessageId: inboundMessageId ?? null,
        processedInboundIds: processedIds,
        inboundMessageType: messageType ?? "text",
        inboundProvider: provider,
      },
    },
  });
}

/**
 * Store an inbound WhatsApp message on the prospect's comm log.
 */
export async function recordWhatsAppInboundMessage({
  tenantId,
  provider,
  phone,
  text,
  inboundMessageId,
  commLogId,
  campaignId,
  contextMessageId,
  repliedAt,
  messageType,
  triggerExecution = true,
}) {
  const trimmedText = String(text ?? "").trim();
  if (!trimmedText) {
    return { stored: false, reason: "empty_message" };
  }

  const repliedAtDate = repliedAt ? new Date(repliedAt) : new Date();

  let log = null;

  if (commLogId) {
    log = await prisma.communicationLog.findFirst({
      where: { id: commLogId, tenantId, channel: "whatsapp" },
    });
  }

  if (!log && contextMessageId) {
    log = await findWhatsAppCommLogByMessageId(tenantId, contextMessageId);
  }

  let prospect = null;
  if (!log && phone) {
    prospect = await findProspectByWhatsAppPhone(tenantId, phone);
    if (prospect) {
      log = await findWhatsAppCommLogForProspect({
        tenantId,
        prospectId: prospect.id,
        campaignId: campaignId ?? prospect.campaignId,
      });
    }
  }

  if (!log && prospect) {
    if (inboundMessageId) {
      const priorInbound = await prisma.communicationLog.findFirst({
        where: {
          tenantId,
          campaignContactId: prospect.id,
          channel: "whatsapp",
          deliveryMeta: {
            path: ["lastInboundMessageId"],
            equals: inboundMessageId,
          },
        },
      });
      if (priorInbound) {
        return {
          stored: false,
          reason: "duplicate",
          commLogId: priorInbound.id,
          prospectId: prospect.id,
        };
      }
    }

    await refreshWhatsAppSessionWindow(prospect.id, repliedAtDate);

    const created = await createInboundOnlyCommLog({
      tenantId,
      campaignContactId: prospect.id,
      campaignId: campaignId ?? prospect.campaignId,
      provider,
      trimmedText,
      inboundMessageId,
      repliedAtDate,
      messageType,
    });

    await syncCampaignMetrics(prisma, created.campaignId);
    await syncCampaignContactStatus(prisma, created.campaignContactId);

    const activeCampaign = await prisma.campaign.findFirst({
      where: { id: created.campaignId, status: "active" },
      select: { id: true },
    });
    if (activeCampaign) {
      await prisma.campaignContact.update({
        where: { id: created.campaignContactId },
        data: { nextScheduledOutreachAt: new Date() },
      });
    }

    let ranExecution = false;
    const autoExecute =
      triggerExecution &&
      (await shouldAutoExecuteOnWebhook(created.campaignId));
    if (autoExecute) {
      await runExecutionForCampaign(created.campaignId, {
        campaignContactIds: [created.campaignContactId],
        skipDailyLimit: true,
        forceWhatsAppFreeform: true,
      });
      ranExecution = true;
    } else {
      await runPostTrackQualification(prisma, created.campaignId, {
        campaignContactIds: [created.campaignContactId],
      });
    }

    return {
      stored: true,
      commLogId: created.id,
      prospectId: created.campaignContactId,
      campaignId: created.campaignId,
      responseContent: trimmedText,
      ranExecution,
      inboundOnly: true,
    };
  }

  if (!log) {
    return {
      stored: false,
      reason: "no_matching_comm_log",
      phone: normalizePhone(phone),
    };
  }

  if (alreadyProcessedInbound(log, inboundMessageId)) {
    return {
      stored: false,
      reason: "duplicate",
      commLogId: log.id,
      prospectId: log.campaignContactId,
    };
  }

  const priorInbound = log.responseContent?.trim();
  let responseContent = trimmedText;

  if (log.responseType === "reply" && priorInbound && priorInbound !== trimmedText) {
    if (!priorInbound.includes(trimmedText)) {
      responseContent = `${priorInbound}\n\n${trimmedText}`;
    } else {
      responseContent = priorInbound;
    }
  }

  const processedIds = [
    ...new Set([
      ...(Array.isArray(log.deliveryMeta?.processedInboundIds)
        ? log.deliveryMeta.processedInboundIds
        : []),
      ...(inboundMessageId ? [inboundMessageId] : []),
    ]),
  ].slice(-20);

  const updated = await prisma.communicationLog.update({
    where: { id: log.id },
    data: {
      responseType: "reply",
      responseAt: repliedAtDate,
      responseContent,
      status: "delivered",
      openedAt: log.openedAt ?? repliedAtDate,
      deliveryProvider: log.deliveryProvider ?? provider ?? "meta",
      deliveryMeta: mergeDeliveryMeta(log, {
        lastInboundMessageId: inboundMessageId ?? null,
        processedInboundIds: processedIds,
        inboundMessageType: messageType ?? "text",
        inboundProvider: provider,
      }),
    },
  });

  await refreshWhatsAppSessionWindow(updated.campaignContactId, repliedAtDate);
  await syncCampaignMetrics(prisma, updated.campaignId);
  await syncCampaignContactStatus(prisma, updated.campaignContactId);

  const activeCampaign = await prisma.campaign.findFirst({
    where: { id: updated.campaignId, status: "active" },
    select: { id: true },
  });
  if (activeCampaign) {
    await prisma.campaignContact.update({
      where: { id: updated.campaignContactId },
      data: { nextScheduledOutreachAt: new Date() },
    });
  }

  let ranExecution = false;
  const autoExecute =
    triggerExecution && (await shouldAutoExecuteOnWebhook(updated.campaignId));
  if (autoExecute) {
    await runExecutionForCampaign(updated.campaignId, {
      campaignContactIds: [updated.campaignContactId],
      skipDailyLimit: true,
      forceWhatsAppFreeform: true,
    });
    ranExecution = true;
  } else {
    await runPostTrackQualification(prisma, updated.campaignId, {
      campaignContactIds: [updated.campaignContactId],
    });
  }

  return {
    stored: true,
    commLogId: updated.id,
    prospectId: updated.campaignContactId,
    campaignId: updated.campaignId,
    responseContent,
    ranExecution,
  };
}

/** Extract plain text from a Meta Cloud API inbound message object. */
export function extractMetaInboundMessage(message) {
  if (!message || message.type === "reaction") return null;

  const type = message.type ?? "text";

  if (type === "text") {
    return message.text?.body?.trim() || null;
  }
  if (type === "button") {
    return message.button?.text?.trim() || null;
  }
  if (type === "interactive") {
    const interactive = message.interactive;
    return (
      interactive?.button_reply?.title?.trim() ||
      interactive?.list_reply?.title?.trim() ||
      interactive?.nfm_reply?.body?.trim() ||
      null
    );
  }
  if (type === "image" || type === "video" || type === "document") {
    const caption = message[type]?.caption?.trim();
    if (caption) return caption;
    return `[${type} message]`;
  }
  if (type === "audio") return "[voice message]";
  if (type === "location") {
    const loc = message.location;
    if (loc?.name) return `Location: ${loc.name}`;
    return "[location shared]";
  }

  return null;
}

/** Parse Interakt message_received (and similar) webhook bodies. */
export function parseInteraktInboundWebhook(body) {
  const type = String(body?.type ?? body?.event ?? "").toLowerCase();

  if (type !== "message_received" && !type.includes("message_received")) {
    return null;
  }

  const data = body?.data ?? body;
  const customer = data?.customer ?? {};
  const msg = data?.message ?? {};

  const phone =
    customer.channel_phone_number ??
    customer.phone_number ??
    data?.phone_number ??
    null;

  const text =
    (typeof msg.message === "string" ? msg.message : null) ??
    msg.text?.body ??
    msg.text ??
    null;

  const contentType = msg.message_content_type ?? msg.type ?? "Text";
  let displayText = text?.trim() || null;
  if (!displayText && msg.media_url) {
    displayText = `[${contentType} message]`;
  }

  const callback = data?.callback_data ?? data?.callbackData ?? body?.callback_data;
  let commLogId = null;
  let campaignId = null;
  if (callback) {
    try {
      const parsed =
        typeof callback === "string" ? JSON.parse(callback) : callback;
      commLogId = parsed?.commLogId ?? null;
      campaignId = parsed?.campaignId ?? null;
    } catch {
      /* ignore */
    }
  }

  return {
    phone,
    text: displayText,
    inboundMessageId: msg.id ?? null,
    commLogId,
    campaignId,
    repliedAt: msg.received_at_utc ?? body?.timestamp ?? null,
    messageType: contentType,
  };
}

/** Parse Meta webhook POST body into inbound message events. */
export function parseMetaInboundWebhook(body) {
  const events = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value?.messages) continue;

      for (const message of value.messages) {
        const text = extractMetaInboundMessage(message);
        if (!text) continue;

        events.push({
          phone: message.from,
          text,
          inboundMessageId: message.id,
          contextMessageId: message.context?.id ?? null,
          repliedAt: message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : null,
          messageType: message.type ?? "text",
        });
      }
    }
  }
  return events;
}

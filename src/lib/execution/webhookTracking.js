import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { applyEngagementToCommLog } from "@/lib/smartleadOutreach";
import {
  applyLinkedInConnectedEngagement,
  applyLinkedInReplyEngagement,
} from "@/lib/execution/applyChannelEngagement";
import { runExecutionForCampaign } from "@/lib/execution/runCampaignExecution";
import { runPostTrackQualification } from "@/lib/execution/qualifyProspect";
import { shouldAutoExecuteOnWebhook } from "@/lib/execution/webhookAutoExecute";
import { syncContactCampaignStatus } from "@/lib/syncContactCampaignStatus";
import {
  getDecryptedSigningSecret,
  markWebhookEvent,
} from "@/lib/integrationWebhooks";
import { contactCampaignInclude } from "@/lib/campaignDetail";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { findContactCampaignsForLinkedInSender } from "@/lib/execution/resolveLinkedInWebhookContact";

async function findContactCampaignByEmail(campaignId, email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return prisma.contactCampaign.findFirst({
    where: {
      campaignId,
      contact: {
        businessUser: {
          email: { equals: normalized, mode: "insensitive" },
        },
      },
    },
    include: contactCampaignInclude,
  });
}

async function findLatestEmailLog(campaignId, contactCampaignId) {
  return prisma.communicationLog.findFirst({
    where: {
      campaignId,
      contactCampaignId,
      channel: "email",
      status: { in: ["planned", "queued", "sent", "delivered"] },
    },
    orderBy: { sentAt: "desc" },
  });
}

async function afterWebhookReply(campaignId, contactCampaignId) {
  try {
    await runPostTrackQualification(prisma, campaignId, {
      contactCampaignIds: [contactCampaignId],
    });
  } catch (err) {
    console.error("[webhook] qualification failed:", err.message);
  }
}

async function triggerReplyExecution(campaignId, contactCampaignId) {
  if (!(await shouldAutoExecuteOnWebhook(campaignId))) {
    await afterWebhookReply(campaignId, contactCampaignId);
    return;
  }

  try {
    await runExecutionForCampaign(campaignId, {
      contactCampaignIds: [contactCampaignId],
      skipDailyLimit: true,
    });
  } catch (err) {
    console.error("[webhook] reply execution failed:", err.message);
  }
}

export function verifySmartleadSignature(rawBody, signatureHeader, signingSecret) {
  if (!signingSecret || !signatureHeader) return false;
  const expected =
    "sha256=" +
    createHmac("sha256", signingSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

/**
 * Linkup V2: HMAC-SHA256 over "{X-Linkup-Timestamp}.{raw_body}", header "v1=<hex>".
 * @see https://docs.linkupapi.com/api-reference/v2/webhooks/signature
 */
export function verifyLinkupSignature(
  rawBody,
  signatureHeader,
  signingSecret,
  timestampHeader
) {
  if (!signingSecret || !signatureHeader || !timestampHeader) return false;

  const sig = String(signatureHeader).trim();
  if (!sig.startsWith("v1=")) return false;

  const ts = parseInt(String(timestampHeader).trim(), 10);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 600) return false;

  const expected = createHmac("sha256", signingSecret)
    .update(`${String(timestampHeader).trim()}.`)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig.slice(3)));
  } catch {
    return false;
  }
}

/** Parse Linkup V2 webhook wrapper — event.type is nested under body.event. */
export function parseLinkupWebhookPayload(body) {
  const eventObj =
    body?.event && typeof body.event === "object" ? body.event : null;
  const eventType =
    eventObj?.type ?? body?.type ?? body?.event_type ?? null;

  return {
    eventType,
    event: eventObj,
    accountId: body?.account_id ?? null,
  };
}

export async function handleSmartleadWebhookEvent(tenantId, event) {
  const eventType = event?.event_type;
  const toEmail = event?.to_email || event?.lead_email;
  const smartleadCampaignId = event?.campaign_id;

  if (!toEmail) {
    await markWebhookEvent(tenantId, "smartlead", { error: "missing email" });
    return { processed: false };
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      tenantId,
      ...(smartleadCampaignId
        ? { smartleadCampaignId: Number(smartleadCampaignId) }
        : {}),
    },
    select: { id: true, smartleadCampaignId: true },
  });

  let processed = false;
  for (const campaign of campaigns) {
    const cc = await findContactCampaignByEmail(campaign.id, toEmail);
    if (!cc) continue;

    const log = await findLatestEmailLog(campaign.id, cc.id);
    if (!log) continue;

    if (eventType === "EMAIL_OPEN") {
      await applyEngagementToCommLog(log, {
        activity: "open",
        openedAt: event.time_opened ? new Date(event.time_opened) : new Date(),
      });
      await syncContactCampaignStatus(prisma, cc.id);
      processed = true;
    }

    if (eventType === "EMAIL_LINK_CLICK") {
      await prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          ctaClickedAt: event.time_clicked
            ? new Date(event.time_clicked)
            : new Date(),
        },
      });
      processed = true;
    }

    if (eventType === "EMAIL_REPLY") {
      await applyEngagementToCommLog(log, {
        activity: "reply",
        responseContent:
          event.preview_text || event.reply_body || event.subject || "",
        repliedAt: event.time_replied ? new Date(event.time_replied) : new Date(),
      });
      await syncContactCampaignStatus(prisma, cc.id);
      await triggerReplyExecution(campaign.id, cc.id);
      processed = true;
    }

    if (eventType === "EMAIL_SENT" || eventType === "FIRST_EMAIL_SENT") {
      await prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          status: "sent",
          deliveredAt: event.time_sent
            ? new Date(event.time_sent)
            : log.deliveredAt ?? new Date(),
        },
      });
      processed = true;
    }

    if (eventType === "EMAIL_BOUNCE") {
      await prisma.communicationLog.update({
        where: { id: log.id },
        data: { status: "failed", decisionReason: "Email bounced" },
      });
      processed = true;
    }

    if (processed) {
      await syncCampaignMetrics(prisma, campaign.id);
    }
  }

  await markWebhookEvent(tenantId, "smartlead");
  return { processed };
}

export async function handleLinkupWebhookEvent(tenantId, body) {
  const { eventType, event: eventPayload, accountId } =
    parseLinkupWebhookPayload(body);

  if (!eventType) {
    await markWebhookEvent(tenantId, "linkup", { error: "missing event type" });
    return { processed: false, reason: "missing_event_type" };
  }

  const linkedin = await getLinkedInIntegrationWithAccountId(tenantId);
  if (
    accountId &&
    linkedin?.linkupAccountIdPlain &&
    accountId !== linkedin.linkupAccountIdPlain
  ) {
    console.warn("[linkup webhook] account_id mismatch", {
      tenantId,
      eventAccountId: accountId,
      integrationAccountId: linkedin.linkupAccountIdPlain,
    });
    await markWebhookEvent(tenantId, "linkup", {
      error: "Webhook account mismatch — use Reconnect webhook after linking LinkedIn",
    });
    return { processed: false, reason: "account_mismatch" };
  }

  if (eventType === "disconnection") {
    await markWebhookEvent(tenantId, "linkup");
    return {
      processed: false,
      reason: "disconnection",
      message: eventPayload?.reason ?? null,
    };
  }

  let processed = false;
  const linkupAccountId = linkedin?.linkupAccountIdPlain ?? null;

  if (
    eventType === "accepted_invitation" ||
    eventType === "connection_accepted"
  ) {
    const connections = eventPayload?.new_connections?.length
      ? eventPayload.new_connections
      : eventPayload?.profile_url
        ? [
            {
              profile_url: eventPayload.profile_url,
              name: eventPayload.name,
            },
          ]
        : [];

    for (const conn of connections) {
      const matches = await findContactCampaignsForLinkedInSender(tenantId, {
        profileUrl: conn.profile_url,
        senderName: conn.name,
        linkupAccountId,
      });

      for (const cc of matches) {
        const connLog = await prisma.communicationLog.findFirst({
          where: {
            campaignId: cc.campaignId,
            contactCampaignId: cc.id,
            channel: "linkedin",
            ctaType: "connect_linkedin",
          },
          orderBy: { sentAt: "desc" },
        });
        if (!connLog) continue;

        await applyLinkedInConnectedEngagement(connLog, {
          message: conn.name
            ? `Connection accepted — ${conn.name}`
            : "Connection accepted",
        });
        await syncContactCampaignStatus(prisma, cc.id);
        processed = true;
        await syncCampaignMetrics(prisma, cc.campaignId);
      }
    }
  }

  if (eventType === "message" || eventType === "message_received") {
    const profileUrl =
      eventPayload?.sender?.profile_url ??
      eventPayload?.sender_profile_url ??
      eventPayload?.profile_url;
    const messageText =
      eventPayload?.message_text ??
      eventPayload?.message ??
      eventPayload?.text ??
      eventPayload?.content ??
      "";
    const senderName = eventPayload?.sender?.name ?? null;
    const entityUrn = eventPayload?.metadata?.entity_urn ?? null;

    const matches = await findContactCampaignsForLinkedInSender(tenantId, {
      profileUrl,
      senderName,
      entityUrn,
      linkupAccountId,
    });

    if (!matches.length) {
      console.warn("[linkup webhook] no matching campaign contact", {
        tenantId,
        eventType,
        profileUrl,
        senderName,
      });
    }

    const repliedAt = eventPayload?.metadata?.delivered_at
      ? new Date(Number(eventPayload.metadata.delivered_at))
      : eventPayload?.timestamp
        ? new Date(eventPayload.timestamp)
        : new Date();

    for (const cc of matches) {
      let dmLog = await prisma.communicationLog.findFirst({
        where: {
          campaignId: cc.campaignId,
          contactCampaignId: cc.id,
          channel: "linkedin",
        },
        orderBy: { sentAt: "desc" },
      });

      if (!dmLog) {
        dmLog = await prisma.communicationLog.create({
          data: {
            tenantId,
            campaignId: cc.campaignId,
            contactCampaignId: cc.id,
            channel: "linkedin",
            message: messageText.trim() || "LinkedIn inbound message",
            status: "delivered",
            responseType: "reply",
            responseContent:
              messageText.trim() || "Prospect replied on LinkedIn",
            responseAt: repliedAt,
            decisionReason: "LinkedIn inbound webhook",
            deliveryProvider: "linkup",
            deliveryMeta: {
              inboundWebhook: true,
              senderProfileUrl: profileUrl ?? null,
              entityUrn,
              linkupEventType: eventType,
            },
          },
        });
      } else {
        await applyLinkedInReplyEngagement(dmLog, {
          responseContent: messageText,
          repliedAt,
        });
      }

      await syncContactCampaignStatus(prisma, cc.id);
      await triggerReplyExecution(cc.campaignId, cc.id);
      processed = true;
      await syncCampaignMetrics(prisma, cc.campaignId);
    }
  }

  await markWebhookEvent(tenantId, "linkup");
  return { processed, eventType };
}

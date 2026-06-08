import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { applyEngagementToCommLog } from "@/lib/smartleadOutreach";
import {
  applyLinkedInConnectedEngagement,
  applyLinkedInReplyEngagement,
} from "@/lib/execution/applyChannelEngagement";
import { runExecutionForCampaign } from "@/lib/execution/runCampaignExecution";
import { syncContactCampaignStatus } from "@/lib/syncContactCampaignStatus";
import {
  getDecryptedSigningSecret,
  markWebhookEvent,
} from "@/lib/integrationWebhooks";
import { contactCampaignInclude } from "@/lib/campaignDetail";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import {
  linkedInMemberIdFromUrl,
  linkedInMemberIdFromUrn,
  linkedInUrlsMatch,
} from "@/lib/linkedinProfileUrl";

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

async function triggerReplyExecution(campaignId, contactCampaignId) {
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

function contactCampaignRows(campaign) {
  return campaign.contactCampaigns ?? [];
}

function matchContactByName(rows, senderName) {
  const normalized = senderName?.trim().toLowerCase();
  if (!normalized) return null;
  const matches = rows.filter(
    (row) =>
      row.contact?.businessUser?.name?.trim().toLowerCase() === normalized
  );
  return matches.length === 1 ? matches[0] : null;
}

function matchContactByLinkedInUrl(rows, profileUrl) {
  if (!profileUrl) return null;
  return (
    rows.find((row) => {
      const url = row.contact?.businessUser?.linkedinUrl;
      return url && linkedInUrlsMatch(url, profileUrl);
    }) ?? null
  );
}

async function matchContactByCommLogProfileIds(campaign, rows, profileUrl) {
  const memberId = linkedInMemberIdFromUrl(profileUrl);
  if (!memberId || rows.length === 0) return null;

  const logs = await prisma.communicationLog.findMany({
    where: {
      campaignId: campaign.id,
      channel: "linkedin",
      contactCampaignId: { in: rows.map((r) => r.id) },
    },
    select: { contactCampaignId: true, deliveryMeta: true },
    orderBy: { sentAt: "desc" },
    take: 200,
  });

  for (const log of logs) {
    const meta = log.deliveryMeta ?? {};
    const fromUrn = linkedInMemberIdFromUrn(meta.profileUrn);
    const fromPublicId = meta.publicIdentifier
      ? String(meta.publicIdentifier).toUpperCase()
      : null;
    if (fromUrn === memberId || fromPublicId === memberId) {
      return rows.find((r) => r.id === log.contactCampaignId) ?? null;
    }
  }

  return null;
}

async function findContactCampaignForLinkedInEvent(
  campaign,
  { profileUrl, senderName }
) {
  const rows = contactCampaignRows(campaign);

  const byUrl = matchContactByLinkedInUrl(rows, profileUrl);
  if (byUrl) return byUrl;

  const byMemberId = await matchContactByCommLogProfileIds(
    campaign,
    rows,
    profileUrl
  );
  if (byMemberId) return byMemberId;

  return matchContactByName(rows, senderName);
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

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId },
    include: {
      contactCampaigns: {
        include: {
          contact: { include: { businessUser: true } },
        },
      },
    },
  });

  let processed = false;

  for (const campaign of campaigns) {
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
        const cc = await findContactCampaignForLinkedInEvent(campaign, {
          profileUrl: conn.profile_url,
          senderName: conn.name,
        });
        if (!cc) continue;

        const connLog = await prisma.communicationLog.findFirst({
          where: {
            campaignId: campaign.id,
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
        await syncCampaignMetrics(prisma, campaign.id);
      }
    }

    // Linkup V2 emits event.type "message" (subscription filter is message_received).
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

      const cc = await findContactCampaignForLinkedInEvent(campaign, {
        profileUrl,
        senderName,
      });
      if (!cc) continue;

      const repliedAt = eventPayload?.metadata?.delivered_at
        ? new Date(Number(eventPayload.metadata.delivered_at))
        : eventPayload?.timestamp
          ? new Date(eventPayload.timestamp)
          : new Date();

      let dmLog = await prisma.communicationLog.findFirst({
        where: {
          campaignId: campaign.id,
          contactCampaignId: cc.id,
          channel: "linkedin",
        },
        orderBy: { sentAt: "desc" },
      });

      if (!dmLog) {
        dmLog = await prisma.communicationLog.create({
          data: {
            tenantId,
            campaignId: campaign.id,
            contactCampaignId: cc.id,
            channel: "linkedin",
            message: messageText.trim() || "LinkedIn inbound message",
            status: "delivered",
            responseType: "reply",
            responseContent: messageText.trim() || "Prospect replied on LinkedIn",
            responseAt: repliedAt,
            decisionReason: "LinkedIn inbound webhook",
            deliveryProvider: "linkup",
            deliveryMeta: {
              inboundWebhook: true,
              senderProfileUrl: profileUrl ?? null,
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
      await triggerReplyExecution(campaign.id, cc.id);
      processed = true;
      await syncCampaignMetrics(prisma, campaign.id);
    }
  }

  if (!processed) {
    console.warn("[linkup webhook] no matching campaign contact", {
      tenantId,
      eventType,
    });
  }

  await markWebhookEvent(tenantId, "linkup");
  return { processed, eventType };
}

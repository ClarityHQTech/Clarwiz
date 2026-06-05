import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { applyEngagementToCommLog } from "@/lib/smartleadOutreach";
import {
  applyLinkedInConnectedEngagement,
  applyLinkedInReplyEngagement,
} from "@/lib/execution/applyChannelEngagement";
import { runExecutionForCampaign } from "@/lib/execution/runCampaignExecution";
import {
  getDecryptedSigningSecret,
  markWebhookEvent,
} from "@/lib/integrationWebhooks";
import { contactCampaignInclude } from "@/lib/campaignDetail";

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
      status: { in: ["sent", "delivered", "queued"] },
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

export function verifyLinkupSignature(rawBody, signatureHeader, signingSecret) {
  if (!signingSecret || !signatureHeader) return false;
  const expected = createHmac("sha256", signingSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
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
      await prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          openedAt: event.time_opened ? new Date(event.time_opened) : new Date(),
          responseType: log.responseType ?? "open",
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
      await prisma.contactCampaign.update({
        where: { id: cc.id },
        data: { status: "REPLIED" },
      });
      await triggerReplyExecution(campaign.id, cc.id);
      processed = true;
    }

    if (eventType === "EMAIL_SENT" || eventType === "FIRST_EMAIL_SENT") {
      await prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          status: "sent",
          deliveredAt: event.time_sent ? new Date(event.time_sent) : new Date(),
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
  const eventType = body?.event ?? body?.type ?? body?.event_type;
  const data = body?.data ?? body;

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
    if (eventType === "accepted_invitation" || eventType === "connection_accepted") {
      const profileUrl =
        data?.profile_url || data?.linkedin_url || data?.invitee_profile_url;
      const cc = campaign.contactCampaigns.find((row) => {
        const url = row.contact?.businessUser?.linkedinUrl;
        return (
          url &&
          profileUrl &&
          url.toLowerCase().includes(
            profileUrl.toLowerCase().split("/").filter(Boolean).pop() ?? "___"
          )
        );
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
      if (connLog) {
        await applyLinkedInConnectedEngagement(connLog, {
          message: data?.message ?? "Connection accepted",
        });
        processed = true;
        await syncCampaignMetrics(prisma, campaign.id);
      }
    }

    if (eventType === "message_received") {
      const profileUrl = data?.sender_profile_url || data?.profile_url;
      const messageText = data?.message || data?.text || data?.content || "";
      const cc = campaign.contactCampaigns.find((row) => {
        const url = row.contact?.businessUser?.linkedinUrl;
        return (
          url &&
          profileUrl &&
          (url === profileUrl || url.includes(profileUrl.replace(/\/$/, "")))
        );
      });
      if (!cc) continue;

      const dmLog = await prisma.communicationLog.findFirst({
        where: {
          campaignId: campaign.id,
          contactCampaignId: cc.id,
          channel: "linkedin",
        },
        orderBy: { sentAt: "desc" },
      });
      if (dmLog) {
        await applyLinkedInReplyEngagement(dmLog, {
          responseContent: messageText,
        });
        await prisma.contactCampaign.update({
          where: { id: cc.id },
          data: { status: "REPLIED" },
        });
        await triggerReplyExecution(campaign.id, cc.id);
        processed = true;
        await syncCampaignMetrics(prisma, campaign.id);
      }
    }
  }

  await markWebhookEvent(tenantId, "linkup");
  return { processed };
}

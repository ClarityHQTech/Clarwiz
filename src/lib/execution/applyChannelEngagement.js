import { prisma } from "@/lib/prisma";
import { syncContactCampaignStatus } from "@/lib/syncContactCampaignStatus";

function mergeDeliveryMeta(log, patch) {
  return {
    ...(log.deliveryMeta && typeof log.deliveryMeta === "object"
      ? log.deliveryMeta
      : {}),
    ...patch,
    lastTrackedAt: new Date().toISOString(),
  };
}

/**
 * Apply LinkedIn connection accepted engagement to a comm log.
 */
export async function applyLinkedInConnectedEngagement(log, { invitationState, message }) {
  if (log.responseType === "reply" || log.responseType === "connected") {
    return { updated: false, log, activity: null };
  }

  const updated = await prisma.communicationLog.update({
    where: { id: log.id },
    data: {
      responseType: "connected",
      responseAt: new Date(),
      responseContent:
        message?.trim() || "LinkedIn connection accepted",
      status: log.status === "planned" ? "delivered" : log.status,
      deliveryProvider: log.deliveryProvider ?? "linkup",
      deliveryMeta: mergeDeliveryMeta(log, {
        invitationState: invitationState ?? "ACCEPTED",
      }),
    },
  });

  await syncContactCampaignStatus(prisma, updated.contactCampaignId);

  return { updated: true, log: updated, activity: "connected" };
}

/**
 * Apply LinkedIn DM reply engagement to a comm log.
 */
export async function applyLinkedInReplyEngagement(log, { responseContent, repliedAt }) {
  if (log.responseType === "reply") {
    return { updated: false, log, activity: null };
  }

  const updated = await prisma.communicationLog.update({
    where: { id: log.id },
    data: {
      responseType: "reply",
      responseAt: repliedAt ? new Date(repliedAt) : new Date(),
      responseContent:
        responseContent?.trim() || "Prospect replied on LinkedIn",
      status: "delivered",
      deliveryProvider: log.deliveryProvider ?? "linkup",
      deliveryMeta: mergeDeliveryMeta(log, {}),
    },
  });

  await syncContactCampaignStatus(prisma, updated.contactCampaignId);

  return { updated: true, log: updated, activity: "reply" };
}

/**
 * Apply WhatsApp delivery/read/reply engagement to a comm log.
 */
export async function applyWhatsAppEngagement(log, engagement) {
  if (!engagement?.activity) return { updated: false, log, activity: null };

  const data = {
    deliveryProvider: log.deliveryProvider ?? engagement.provider ?? "meta",
    deliveryMeta: mergeDeliveryMeta(log, engagement.deliveryMeta ?? {}),
  };

  if (engagement.activity === "delivered" && !log.deliveredAt) {
    data.deliveredAt = engagement.deliveredAt
      ? new Date(engagement.deliveredAt)
      : new Date();
    if (log.status === "planned" || log.status === "sent") {
      data.status = "delivered";
    }
  }

  if (engagement.activity === "read" && !log.openedAt) {
    data.openedAt = engagement.readAt ? new Date(engagement.readAt) : new Date();
    if (!data.status && (log.status === "planned" || log.status === "sent")) {
      data.status = "delivered";
    }
  }

  if (engagement.activity === "reply" && !log.responseType) {
    data.responseType = "reply";
    data.responseAt = engagement.repliedAt
      ? new Date(engagement.repliedAt)
      : new Date();
    data.responseContent =
      engagement.responseContent?.trim() ||
      "Prospect replied on WhatsApp";
    data.status = "delivered";
    if (!log.openedAt) {
      data.openedAt = data.responseAt;
    }
  }

  const hasChanges =
    data.deliveredAt ||
    data.openedAt ||
    data.responseType ||
    (engagement.activity === "delivered" && data.status);

  if (!hasChanges && engagement.activity !== "failed") {
    return { updated: false, log, activity: null };
  }

  const updated = await prisma.communicationLog.update({
    where: { id: log.id },
    data,
  });

  await syncContactCampaignStatus(prisma, updated.contactCampaignId);

  return { updated: true, log: updated, activity: engagement.activity };
}

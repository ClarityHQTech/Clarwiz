import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { isProspectReply } from "@/lib/commLogEngagement";

const OUTBOUND_STATUSES = new Set(["planned", "sent", "delivered"]);

/**
 * Derive campaign metrics from CommunicationLog rows (source of truth for UI).
 */
export function computeCampaignMetrics(commLogs, prospectCount = 0, qualifiedCount = 0) {
  const outbound = commLogs.filter(
    (l) => l.status !== "skipped" && OUTBOUND_STATUSES.has(l.status)
  );
  const sent = outbound.length;
  const opened = outbound.filter((l) => l.openedAt).length;
  const withReply = commLogs.filter(isProspectReply);
  const replyCount = withReply.length;

  const contactedIds = new Set(outbound.map((l) => l.campaignContactId));
  const repliedIds = new Set(withReply.map((l) => l.campaignContactId));

  const openRate = sent > 0 ? (opened / sent) * 100 : 0;
  const replyRate =
    contactedIds.size > 0 ? (repliedIds.size / contactedIds.size) * 100 : 0;

  return {
    prospectCount,
    sent,
    openRate,
    replyRate,
    replyCount,
    repliedProspects: repliedIds.size,
    qualifiedLeads: qualifiedCount,
    opened,
  };
}

export async function syncCampaignMetrics(prisma, campaignId) {
  const [logs, campaignContactCount, qualifiedCount] = await Promise.all([
    prisma.communicationLog.findMany({ where: { campaignId } }),
    prisma.campaignContact.count({ where: { campaignId } }),
    prisma.campaignContact.count({
      where: { campaignId, status: "QUALIFIED" },
    }),
  ]);

  const metrics = computeCampaignMetrics(
    logs,
    campaignContactCount,
    qualifiedCount
  );

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: metrics.sent,
      openRate: metrics.openRate,
      replyRate: metrics.replyRate,
      qualifiedLeads: metrics.qualifiedLeads,
    },
  });
}

export function serializeCommLogForUi(log, { contactName, prospectName, message, subject } = {}) {
  const name = contactName ?? prospectName ?? null;
  return {
    id: log.id,
    campaignContactId: log.campaignContactId,
    prospectId: log.campaignContactId,
    contactName: name,
    prospectName: name,
    channel: log.channel,
    channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
    stage: log.stage,
    subject: subject ?? log.subject,
    message: message ?? log.message,
    ctaType: log.ctaType,
    status: log.status,
    sentAt: log.sentAt?.toISOString?.() ?? log.sentAt,
    deliveredAt: log.deliveredAt?.toISOString?.() ?? log.deliveredAt ?? null,
    openedAt: log.openedAt?.toISOString?.() ?? log.openedAt ?? null,
    ctaClickedAt: log.ctaClickedAt?.toISOString?.() ?? log.ctaClickedAt ?? null,
    deliveryProvider: log.deliveryProvider ?? null,
    deliveryMeta: log.deliveryMeta ?? null,
    responseType: log.responseType,
    responseAt: log.responseAt?.toISOString?.() ?? log.responseAt ?? null,
    responseContent: log.responseContent,
    decisionReason: log.decisionReason,
    modelUsed: log.modelUsed ?? null,
    providerUsage: log.providerUsage ?? null,
    providerCost: log.providerCost ?? null,
    templateId: log.templateId ?? null,
    signalRef: log.signalRef ?? null,
    isReply: isProspectReply(log),
    isOpened: Boolean(log.openedAt),
  };
}

export function serializeCommLogDetail(log, opts = {}) {
  return serializeCommLogForUi(log, opts);
}

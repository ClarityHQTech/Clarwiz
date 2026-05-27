import { CHANNEL_LABELS } from "@/lib/campaignConstants";

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
  const withReply = commLogs.filter((l) => l.responseType);
  const replyCount = withReply.length;

  const contactedProspectIds = new Set(outbound.map((l) => l.prospectId));
  const repliedProspectIds = new Set(withReply.map((l) => l.prospectId));

  const openRate = sent > 0 ? (opened / sent) * 100 : 0;
  const replyRate =
    contactedProspectIds.size > 0
      ? (repliedProspectIds.size / contactedProspectIds.size) * 100
      : 0;

  return {
    prospectCount,
    sent,
    openRate,
    replyRate,
    replyCount,
    repliedProspects: repliedProspectIds.size,
    qualifiedLeads: qualifiedCount,
    opened,
  };
}

export async function syncCampaignMetrics(prisma, campaignId) {
  const [logs, prospectCount, qualifiedCount] = await Promise.all([
    prisma.communicationLog.findMany({ where: { campaignId } }),
    prisma.prospect.count({ where: { campaignId } }),
    prisma.prospect.count({
      where: { campaignId, qualifiedAt: { not: null } },
    }),
  ]);

  const metrics = computeCampaignMetrics(logs, prospectCount, qualifiedCount);

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

export function serializeCommLogForUi(log, { prospectName } = {}) {
  return {
    id: log.id,
    prospectId: log.prospectId,
    prospectName: prospectName ?? null,
    channel: log.channel,
    channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
    stage: log.stage,
    subject: log.subject,
    message: log.message,
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
    isReply: Boolean(log.responseType && log.responseContent),
  };
}

export function serializeCommLogDetail(log, { prospectName } = {}) {
  return serializeCommLogForUi(log, { prospectName });
}

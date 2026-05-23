import { CHANNEL_LABELS } from "@/lib/campaignConstants";

const OUTBOUND_STATUSES = new Set(["planned", "sent", "delivered"]);

/**
 * Derive campaign metrics from CommunicationLog rows (source of truth for UI).
 */
export function computeCampaignMetrics(commLogs, prospectCount = 0) {
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
    qualifiedLeads: repliedProspectIds.size,
    opened,
  };
}

export async function syncCampaignMetrics(prisma, campaignId) {
  const [logs, prospectCount] = await Promise.all([
    prisma.communicationLog.findMany({ where: { campaignId } }),
    prisma.prospect.count({ where: { campaignId } }),
  ]);

  const metrics = computeCampaignMetrics(logs, prospectCount);

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

export function serializeCommLogForUi(log) {
  return {
    id: log.id,
    prospectId: log.prospectId,
    channel: log.channel,
    channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
    stage: log.stage,
    subject: log.subject,
    message: log.message,
    ctaType: log.ctaType,
    status: log.status,
    sentAt: log.sentAt?.toISOString?.() ?? log.sentAt,
    openedAt: log.openedAt?.toISOString?.() ?? log.openedAt ?? null,
    responseType: log.responseType,
    responseAt: log.responseAt?.toISOString?.() ?? log.responseAt ?? null,
    responseContent: log.responseContent,
    decisionReason: log.decisionReason,
    isReply: Boolean(log.responseType && log.responseContent),
  };
}

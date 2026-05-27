import { prisma } from "@/lib/prisma";
import { CHANNEL_LABELS, CTA_OPTIONS } from "@/lib/campaignConstants";
import {
  countWhatsAppNumberedVariables,
  defaultWhatsAppVariableMapping,
} from "@/lib/whatsappTemplateVariables";
import {
  computeCampaignMetrics,
  serializeCommLogDetail,
} from "@/lib/campaignMetrics";
import { getCalendlyIntegration } from "@/lib/calendlyIntegration";

function ctaLabel(value) {
  return CTA_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export const campaignDetailInclude = {
  prospects: { orderBy: { name: "asc" } },
  templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] },
  commLogs: { orderBy: { sentAt: "desc" }, take: 200 },
};

export async function serializeCampaignDetail(campaign, { calendlyConnected = null } = {}) {
  const prospectCount = campaign.prospects.length;
  const qualifiedCount = campaign.prospects.filter((p) => p.qualifiedAt).length;
  const commLogs = campaign.commLogs ?? [];
  const metrics = computeCampaignMetrics(commLogs, prospectCount, qualifiedCount);

  const prospectNameById = Object.fromEntries(
    campaign.prospects.map((p) => [p.id, p.name])
  );

  const logsByProspect = {};
  for (const log of commLogs) {
    if (!logsByProspect[log.prospectId]) logsByProspect[log.prospectId] = [];
    logsByProspect[log.prospectId].push(
      serializeCommLogDetail(log, {
        prospectName: prospectNameById[log.prospectId],
      })
    );
  }

  const maxStage =
    campaign.templates.length > 0
      ? Math.max(...campaign.templates.map((t) => t.stage))
      : 0;

  const channelsConfigured = [
    ...new Set(campaign.templates.map((t) => t.channel)),
  ];

  const sentPercent =
    prospectCount > 0
      ? Math.min(100, Math.round((metrics.sent / prospectCount) * 100))
      : 0;

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    targetSegment: campaign.targetSegment,
    goals: campaign.goals,
    status: campaign.status,
    calendlyBookingUrl: campaign.calendlyBookingUrl ?? null,
    calendlyConnected:
      calendlyConnected === null ? undefined : Boolean(calendlyConnected),
    startDate: campaign.startDate?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    metrics: {
      prospectCount: metrics.prospectCount,
      sent: metrics.sent,
      openRate: metrics.openRate,
      replyRate: metrics.replyRate,
      replyCount: metrics.replyCount,
      repliedProspects: metrics.repliedProspects,
      qualifiedLeads: metrics.qualifiedLeads,
      opened: metrics.opened,
    },
    progress: {
      sentPercent,
      maxStage,
      templateCount: campaign.templates.length,
      channelsConfigured: channelsConfigured.map(
        (ch) => CHANNEL_LABELS[ch] ?? ch
      ),
    },
    commLogs: commLogs.map((log) =>
      serializeCommLogDetail(log, {
        prospectName: prospectNameById[log.prospectId],
      })
    ),
    templates: campaign.templates
      .sort((a, b) => a.channel.localeCompare(b.channel) || a.stage - b.stage)
      .map((t) => ({
        id: t.id,
        channel: t.channel,
        channelLabel: CHANNEL_LABELS[t.channel] ?? t.channel,
        stage: t.stage,
        subject: t.subject,
        body: t.body,
        cta: t.cta,
        ctaLabel: ctaLabel(t.cta),
        whatsappTemplateId: t.whatsappTemplateId,
        whatsappVariableMapping:
          t.whatsappVariableMapping ??
          (t.channel === "whatsapp" &&
          countWhatsAppNumberedVariables(t.body) > 0
            ? defaultWhatsAppVariableMapping({
                body: t.body,
                variableCount: countWhatsAppNumberedVariables(t.body),
              })
            : null),
        whatsappBodyVariableCount:
          t.channel === "whatsapp"
            ? countWhatsAppNumberedVariables(t.body)
            : 0,
      })),
    prospects: campaign.prospects.map((p) => {
      const communications = logsByProspect[p.id] ?? [];
      const hasReply = communications.some((c) => c.responseType);
      return {
        id: p.id,
        name: p.name,
        firstName: p.firstName,
        company: p.company,
        jobTitle: p.jobTitle,
        painPoint: p.painPoint,
        phone: p.phone,
        whatsapp: p.whatsapp,
        email: p.email,
        linkedinUrl: p.linkedinUrl,
        qualifiedAt: p.qualifiedAt?.toISOString?.() ?? null,
        qualifiedReason: p.qualifiedReason ?? null,
        isQualified: Boolean(p.qualifiedAt),
        communications,
        messageCount: communications.filter((c) => c.status !== "skipped")
          .length,
        hasReply,
      };
    }),
  };
}

export async function getOwnedCampaignDetail(id, userId) {
  return prisma.campaign.findFirst({
    where: { id, userId },
    include: campaignDetailInclude,
  });
}

export async function fetchSerializedCampaign(id, userId) {
  const campaign = await getOwnedCampaignDetail(id, userId);
  if (!campaign) return null;
  const calendly = await getCalendlyIntegration(userId);
  return serializeCampaignDetail(campaign, {
    calendlyConnected: calendly?.status === "connected",
  });
}

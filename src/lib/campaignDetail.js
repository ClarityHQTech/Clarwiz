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
import { CONTACT_CAMPAIGN_STATUS_LABELS } from "@/lib/contactCampaignStatus";
import { CONTACT_PERSONA_LABELS } from "@/lib/contactPersona";
import { flattenContactCampaign } from "@/lib/resolveBusinessUser";
import { resolveCommLogDisplayContent } from "@/lib/execution/renderCommLogContent";
import {
  normalizeOutreachTimezone,
  utcHHmmToLocal,
} from "@/lib/outreachTimezones";
import { resolveCampaignEnabledChannels } from "@/lib/campaignChannels";
import { isProspectReply } from "@/lib/commLogEngagement";
import { getWhatsAppCopilotUiState } from "@/lib/whatsappSessionWindow";
import {
  reconcileContactCampaignStatusesForCampaign,
  resolveContactCampaignDisplayStatus,
} from "@/lib/syncContactCampaignStatus";

function ctaLabel(value) {
  return CTA_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export const contactCampaignInclude = {
  contact: {
    include: {
      businessUser: { include: { company: true } },
    },
  },
};

export const campaignDetailInclude = {
  contactCampaigns: {
    include: contactCampaignInclude,
    orderBy: { createdAt: "asc" },
  },
  templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] },
  commLogs: { orderBy: { sentAt: "desc" }, take: 200 },
};

export async function serializeCampaignDetail(campaign, { calendlyConnected = null } = {}) {
  const contactCampaigns = campaign.contactCampaigns ?? [];
  const prospectCount = contactCampaigns.length;
  const qualifiedCount = contactCampaigns.filter(
    (cc) => cc.status === "QUALIFIED"
  ).length;
  const commLogs = campaign.commLogs ?? [];
  const metrics = computeCampaignMetrics(commLogs, prospectCount, qualifiedCount);

  const nameByContactCampaignId = Object.fromEntries(
    contactCampaigns.map((cc) => [
      cc.id,
      cc.contact?.businessUser?.name ?? "Contact",
    ])
  );

  const prospectByContactCampaignId = Object.fromEntries(
    contactCampaigns.map((cc) => [cc.id, flattenContactCampaign(cc)])
  );

  const serializeLog = (log, contactCampaignId) => {
    const prospect = prospectByContactCampaignId[contactCampaignId];
    const display = resolveCommLogDisplayContent(log, {
      prospect,
      campaign,
      templates: campaign.templates,
    });
    return serializeCommLogDetail(log, {
      contactName: nameByContactCampaignId[contactCampaignId],
      message: display.message,
      subject: display.subject,
    });
  };

  const logsByContactCampaign = {};
  const rawLogsByContactCampaign = {};
  for (const log of commLogs) {
    const key = log.contactCampaignId;
    if (!logsByContactCampaign[key]) logsByContactCampaign[key] = [];
    if (!rawLogsByContactCampaign[key]) rawLogsByContactCampaign[key] = [];
    rawLogsByContactCampaign[key].push(log);
    logsByContactCampaign[key].push(serializeLog(log, key));
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

  const outreachTimezone = normalizeOutreachTimezone(campaign.outreachTimezone);
  const enabledChannels = resolveCampaignEnabledChannels(campaign);

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
    outreachTimezone,
    defaultOutreachTime: utcHHmmToLocal(
      campaign.defaultOutreachTime ?? "11:00",
      outreachTimezone
    ),
    enabledChannels,
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
    commLogs: commLogs.map((log) => serializeLog(log, log.contactCampaignId)),
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
    contacts: serializeContactCampaignRows(
      contactCampaigns,
      logsByContactCampaign,
      rawLogsByContactCampaign,
      outreachTimezone
    ),
    prospects: serializeContactCampaignRows(
      contactCampaigns,
      logsByContactCampaign,
      rawLogsByContactCampaign,
      outreachTimezone
    ),
  };
}

function serializeContactCampaignRows(
  contactCampaigns,
  logsByContactCampaign,
  rawLogsByContactCampaign,
  outreachTimezone
) {
  return [...contactCampaigns]
    .sort((a, b) =>
      (a.contact?.businessUser?.name ?? "").localeCompare(
        b.contact?.businessUser?.name ?? ""
      )
    )
    .map((cc) => {
      const flat = flattenContactCampaign(cc);
      const communications = logsByContactCampaign[cc.id] ?? [];
      const rawCommunications = rawLogsByContactCampaign[cc.id] ?? [];
      const whatsappWindow = getWhatsAppCopilotUiState(cc, rawCommunications);
      const hasReply = communications.some(isProspectReply);
      const status = resolveContactCampaignDisplayStatus(cc, rawCommunications);
      return {
        id: cc.id,
        contactId: cc.contactId,
        status,
        statusLabel: CONTACT_CAMPAIGN_STATUS_LABELS[status] ?? status,
        persona: flat.persona,
        personaLabel: CONTACT_PERSONA_LABELS[flat.persona] ?? flat.persona,
        name: flat.name,
        firstName: flat.firstName,
        lastName: flat.lastName,
        company: flat.company,
        jobTitle: flat.jobTitle,
        phone: flat.phone,
        whatsapp: flat.whatsapp,
        email: flat.email,
        linkedinUrl: flat.linkedinUrl,
        twitterId: flat.twitterId,
        qualifiedAt: cc.qualifiedAt?.toISOString?.() ?? null,
        qualifiedReason: cc.qualifiedReason ?? null,
        isQualified: status === "QUALIFIED",
        outreachDeliveryTime: cc.outreachDeliveryTime
          ? utcHHmmToLocal(cc.outreachDeliveryTime, outreachTimezone)
          : null,
        nextScheduledOutreachAt:
          cc.nextScheduledOutreachAt?.toISOString?.() ?? null,
        lastOutreachDate: cc.lastOutreachDate?.toISOString?.() ?? null,
        whatsapp24hWindowExpiresAt:
          cc.whatsapp24hWindowExpiresAt?.toISOString?.() ?? null,
        whatsappWindow,
        communications,
        messageCount: communications.filter((c) => c.status !== "skipped")
          .length,
        hasReply,
      };
    });
}

export async function getOwnedCampaignDetail(id, tenantId) {
  return prisma.campaign.findFirst({
    where: { id, tenantId },
    include: campaignDetailInclude,
  });
}

export async function fetchSerializedCampaign(id, tenantId) {
  let campaign = await getOwnedCampaignDetail(id, tenantId);
  if (!campaign) return null;

  const { updated } = await reconcileContactCampaignStatusesForCampaign(
    prisma,
    id
  );
  if (updated > 0) {
    campaign = await getOwnedCampaignDetail(id, tenantId);
    if (!campaign) return null;
  }

  const calendly = await getCalendlyIntegration(tenantId);
  return serializeCampaignDetail(campaign, {
    calendlyConnected: calendly?.status === "connected",
  });
}

/**
 * Build campaign-prospect shape for AE Assist contact drawer — mirrors the
 * campaign contact drawer so ContactCommThread + ContactCopilotComposer work.
 */
import { flattenCampaignContact } from "@/lib/resolveBusinessUser";
import { serializeCommLogDetail } from "@/lib/campaignMetrics";
import { resolveCommLogDisplayContent } from "@/lib/execution/renderCommLogContent";
import { getWhatsAppCopilotUiState } from "@/lib/whatsappSessionWindow";
import { resolveCampaignContactDisplayStatus } from "@/lib/syncCampaignContactStatus";
import { CAMPAIGN_CONTACT_STATUS_LABELS } from "@/lib/campaignContactStatus";
import { CONTACT_PERSONA_LABELS } from "@/lib/contactPersona";
import {
  DEFAULT_ENABLED_CHANNELS,
  resolveCampaignEnabledChannels,
} from "@/lib/campaignChannels";
import { isProspectReply } from "@/lib/commLogEngagement";

/** Serialize one CampaignContact for conversations + manual send in AE Assist. */
export async function buildTofuProspectView(prisma, tenantId, campaignContactId) {
  const cc = await prisma.campaignContact.findFirst({
    where: { id: campaignContactId, campaign: { tenantId } },
    include: {
      contact: { include: { businessUser: { include: { company: true } } } },
      campaign: {
        include: { templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] } },
      },
    },
  });
  if (!cc) return null;

  const rawLogs = await prisma.communicationLog.findMany({
    where: { campaignContactId: cc.id, tenantId },
    orderBy: { sentAt: "asc" },
  });

  const flat = flattenCampaignContact(cc);
  const campaign = cc.campaign;
  const templates = campaign.templates ?? [];

  const communications = rawLogs.map((log) => {
    const display = resolveCommLogDisplayContent(log, {
      prospect: flat,
      campaign,
      templates,
    });
    return serializeCommLogDetail(log, {
      contactName: flat.name,
      message: display.message,
      subject: display.subject,
    });
  });

  const whatsappWindow = getWhatsAppCopilotUiState(cc, rawLogs);
  const status = resolveCampaignContactDisplayStatus(cc, rawLogs);
  const enabledChannels = resolveCampaignEnabledChannels(campaign) ?? DEFAULT_ENABLED_CHANNELS;

  const prospect = {
    id: cc.id,
    contactId: cc.contactId,
    status,
    statusLabel: CAMPAIGN_CONTACT_STATUS_LABELS[status] ?? status,
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
    score: cc.score ?? 0,
    whatsappWindow,
    communications,
    messageCount: communications.filter((c) => c.status !== "skipped").length,
    hasReply: communications.some(isProspectReply),
  };

  return {
    prospect,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      templates,
      enabledChannels,
    },
    campaignContactId: cc.id,
  };
}

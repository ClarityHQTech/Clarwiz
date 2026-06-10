import { getLatestProspectReply } from "@/lib/execution/humanizeOutboundMessage";
import { classifyReplyIntent } from "@/lib/scoring/replyIntent";
import { MAX_SCORE } from "@/lib/scoring/campaignContactScore";
import { syncCampaignContactStatus } from "@/lib/syncCampaignContactStatus";
import { enqueueQualifiedCrmPush } from "@/lib/crm/pushQualifiedToHubspot";

export const QUALIFICATION_REASONS = {
  CALENDLY_BOOKED: "calendly_booked",
  CALENDLY_LINK_CLICKED: "calendly_link_clicked",
  POSITIVE_REPLY: "positive_reply",
  MANUAL: "manual",
};

/** Persist the inferred reply intent on a comm log so scoring can read it. */
async function storeReplyIntent(prismaClient, log, intent, points) {
  if (!log?.id) return;
  const baseMeta =
    log.deliveryMeta && typeof log.deliveryMeta === "object" ? log.deliveryMeta : {};
  await prismaClient.communicationLog
    .update({
      where: { id: log.id },
      data: {
        deliveryMeta: {
          ...baseMeta,
          replyIntent: intent,
          replyScore: points,
          replyIntentAt: new Date().toISOString(),
        },
      },
    })
    .catch(() => {});
}

export async function markCampaignContactQualified(
  prismaClient,
  { campaignContactId, campaignId, reason, sourceMeta = null, businessUserId = null, tenantId = null }
) {
  const cc = await prismaClient.campaignContact.findFirst({
    where: { id: campaignContactId, campaignId },
    include: { contact: true },
  });
  if (!cc) return { updated: false, campaignContact: null };
  if (cc.status === "QUALIFIED") {
    return { updated: false, campaignContact: cc, alreadyQualified: true };
  }

  const campaign = await prismaClient.campaign.findUnique({
    where: { id: campaignId },
    select: { tenantId: true },
  });

  const updated = await prismaClient.campaignContact.update({
    where: { id: campaignContactId },
    data: {
      status: "QUALIFIED",
      qualifiedAt: new Date(),
      qualifiedReason: reason,
      score: MAX_SCORE,
      scoreUpdatedAt: new Date(),
      scoreBreakdown: [
        { label: "Qualified", points: MAX_SCORE, kind: "qualified", reason },
      ],
    },
  });

  const buId = businessUserId ?? cc.contact?.businessUserId;
  if (sourceMeta && campaign?.tenantId && buId) {
    await prismaClient.businessUserSignal
      .create({
        data: {
          businessUserId: buId,
          tenantId: campaign.tenantId,
          campaignId,
          type: "qualification",
          source: reason,
          content: JSON.stringify(sourceMeta).slice(0, 2000),
        },
      })
      .catch(() => {});
  }

  enqueueQualifiedCrmPush(prismaClient, campaignContactId);

  return { updated: true, campaignContact: updated };
}

/** @deprecated */
export const markProspectQualified = markCampaignContactQualified;

/**
 * Intelligently evaluate the latest prospect reply.
 *
 * The reply intent is inferred (positive / neutral / negative) so a negative
 * reply never qualifies (it disqualifies), a genuinely positive reply qualifies
 * immediately, and neutral replies just add their engagement points — which can
 * still push the contact over the score threshold via syncCampaignContactStatus.
 * The inferred intent is persisted on the reply log so the deterministic score
 * recompute stays stable and idempotent.
 */
export async function evaluateCampaignContactQualification(
  prismaClient,
  { campaignContact, prospect, commHistory, campaign }
) {
  const cc = campaignContact ?? prospect;
  if (cc.status === "QUALIFIED" || cc.qualifiedAt) {
    return { qualified: false, skipped: true, reason: "already_qualified" };
  }

  const latestReply = getLatestProspectReply(commHistory);
  if (!latestReply?.responseContent?.trim()) {
    return { qualified: false, skipped: true, reason: "no_reply" };
  }

  const text = latestReply.responseContent.trim();

  const { intent, points, reason: intentReason } = await classifyReplyIntent({
    text,
    channel: latestReply.channel,
    campaign,
  });

  await storeReplyIntent(prismaClient, latestReply, intent, points);

  if (intent === "negative") {
    await prismaClient.campaignContact
      .update({ where: { id: cc.id }, data: { status: "DISQUALIFIED" } })
      .catch(() => {});
    return { qualified: false, intent, reason: intentReason || "negative_reply" };
  }

  if (intent === "positive") {
    await markCampaignContactQualified(prismaClient, {
      campaignContactId: cc.id,
      campaignId: campaign.id,
      reason: QUALIFICATION_REASONS.POSITIVE_REPLY,
      sourceMeta: { channel: latestReply.channel, intent, intentReason },
    });
    return {
      qualified: true,
      intent,
      reason: QUALIFICATION_REASONS.POSITIVE_REPLY,
      llmReason: intentReason,
    };
  }

  // Neutral reply — recompute the score (it may still cross the threshold via
  // accumulated engagement) and advance status.
  const sync = await syncCampaignContactStatus(prismaClient, cc.id);
  return {
    qualified: Boolean(sync.qualifiedByScore),
    intent,
    reason: sync.qualifiedByScore
      ? "score_threshold"
      : intentReason || "neutral_reply",
    score: sync.score,
  };
}

/** @deprecated */
export const evaluateProspectQualification = evaluateCampaignContactQualification;

export async function runPostTrackQualification(
  prismaClient,
  campaignId,
  { campaignContactIds = [], prospectIds = [] } = {}
) {
  const ids = campaignContactIds.length ? campaignContactIds : prospectIds;
  const campaign = await prismaClient.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignContacts: ids.length
        ? { where: { id: { in: ids }, status: { not: "QUALIFIED" } } }
        : { where: { status: { not: "QUALIFIED" } } },
      commLogs: { orderBy: { sentAt: "asc" } },
    },
  });
  if (!campaign) return [];

  const results = [];
  const logsByCc = new Map();
  for (const log of campaign.commLogs) {
    const key = log.campaignContactId;
    const list = logsByCc.get(key) ?? [];
    list.push(log);
    logsByCc.set(key, list);
  }

  for (const cc of campaign.campaignContacts) {
    const commHistory = logsByCc.get(cc.id) ?? [];
    if (!commHistory.some((l) => l.responseType && l.responseContent)) continue;

    try {
      const result = await evaluateCampaignContactQualification(prismaClient, {
        campaignContact: cc,
        commHistory,
        campaign,
      });
      results.push({ campaignContactId: cc.id, prospectId: cc.id, ...result });
    } catch (err) {
      results.push({ campaignContactId: cc.id, error: err.message });
    }
  }

  return results;
}

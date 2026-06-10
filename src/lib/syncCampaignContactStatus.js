import { TERMINAL_CAMPAIGN_CONTACT_STATUSES } from "@/lib/campaignContactStatus";
import { isProspectReply } from "@/lib/commLogEngagement";
import {
  computeCampaignContactScore,
  DEFAULT_SCORE_THRESHOLD,
} from "@/lib/scoring/campaignContactScore";
import { enqueueQualifiedCrmPush } from "@/lib/crm/pushQualifiedToHubspot";

const OUTBOUND_ACTIVE_STATUSES = new Set(["planned", "sent", "delivered", "queued"]);

/** Higher rank = further along the funnel (non-terminal). */
const STATUS_RANK = {
  PENDING: 0,
  IN_OUTREACH: 1,
  REPLIED: 2,
  QUALIFIED: 3,
};

function statusRank(status) {
  return STATUS_RANK[status] ?? -1;
}

/**
 * Derive contact campaign status from comm log history.
 * PENDING → IN_OUTREACH (first send / opened) → REPLIED → QUALIFIED
 */
export function deriveCampaignContactStatus(campaignContact, commLogs = []) {
  if (campaignContact?.status === "QUALIFIED" || campaignContact?.qualifiedAt) {
    return "QUALIFIED";
  }

  if (
    campaignContact?.status &&
    TERMINAL_CAMPAIGN_CONTACT_STATUSES.has(campaignContact.status)
  ) {
    return campaignContact.status;
  }

  const logs = commLogs ?? [];

  if (logs.some(isProspectReply)) {
    return "REPLIED";
  }

  const hasOutbound = logs.some(
    (log) =>
      log.status !== "skipped" &&
      OUTBOUND_ACTIVE_STATUSES.has(log.status) &&
      Boolean(log.message?.trim())
  );

  const hasEngagement = logs.some(
    (log) =>
      log.openedAt ||
      log.ctaClickedAt ||
      (log.channel === "linkedin" && log.responseType === "connected")
  );

  if (hasOutbound || hasEngagement) {
    return "IN_OUTREACH";
  }

  return "PENDING";
}

function scoreBreakdownChanged(previous, next) {
  try {
    return JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null);
  } catch {
    return true;
  }
}

/**
 * Update CampaignContact.status AND recompute the engagement score when comm
 * activity changes. Never downgrades status (e.g. REPLIED → IN_OUTREACH).
 * Respects terminal statuses. Auto-qualifies once the score reaches the
 * campaign's qualification threshold.
 *
 * Score recompute is deterministic and idempotent — driven by comm log signals
 * and the LLM-inferred reply intent stored on each reply log's deliveryMeta.
 */
export async function syncCampaignContactStatus(prismaClient, campaignContactId) {
  if (!campaignContactId) {
    return { updated: false, reason: "missing_id" };
  }

  const cc = await prismaClient.campaignContact.findUnique({
    where: { id: campaignContactId },
    include: {
      campaign: { select: { tenantId: true, qualificationThreshold: true } },
      contact: { select: { businessUserId: true } },
      commLogs: {
        select: {
          id: true,
          status: true,
          message: true,
          openedAt: true,
          deliveredAt: true,
          ctaClickedAt: true,
          responseType: true,
          responseContent: true,
          channel: true,
          deliveryMeta: true,
        },
      },
    },
  });

  if (!cc) {
    return { updated: false, reason: "not_found" };
  }

  // Terminal / already qualified rows keep their status and score as-is.
  if (
    cc.status === "QUALIFIED" ||
    cc.qualifiedAt ||
    (cc.status && TERMINAL_CAMPAIGN_CONTACT_STATUSES.has(cc.status))
  ) {
    return { updated: false, status: cc.status, reason: "terminal" };
  }

  const threshold = cc.campaign?.qualificationThreshold ?? DEFAULT_SCORE_THRESHOLD;
  const { score, breakdown, qualifiedByScore } = computeCampaignContactScore({
    campaignContact: cc,
    commLogs: cc.commLogs,
    threshold,
  });

  const derivedStatus = deriveCampaignContactStatus(cc, cc.commLogs);
  const currentRank = statusRank(cc.status);
  const derivedRank = statusRank(derivedStatus);
  const statusShouldAdvance =
    derivedStatus !== cc.status &&
    (cc.status === "PENDING" || derivedRank > currentRank);

  const data = {};

  if (score !== cc.score) {
    data.score = score;
    data.scoreUpdatedAt = new Date();
  }
  if (scoreBreakdownChanged(cc.scoreBreakdown, breakdown)) {
    data.scoreBreakdown = breakdown;
    data.scoreUpdatedAt = new Date();
  }

  let nextStatus = cc.status;
  let qualifiedByScoreApplied = false;

  if (qualifiedByScore) {
    nextStatus = "QUALIFIED";
    data.status = "QUALIFIED";
    data.qualifiedAt = new Date();
    data.qualifiedReason = "score_threshold";
    qualifiedByScoreApplied = true;
  } else if (statusShouldAdvance) {
    nextStatus = derivedStatus;
    data.status = derivedStatus;
  }

  if (Object.keys(data).length === 0) {
    return { updated: false, status: cc.status, score };
  }

  await prismaClient.campaignContact.update({
    where: { id: campaignContactId },
    data,
  });

  // Record a qualification signal when the threshold trips (best-effort).
  if (qualifiedByScoreApplied && cc.campaign?.tenantId && cc.contact?.businessUserId) {
    await prismaClient.businessUserSignal
      .create({
        data: {
          businessUserId: cc.contact.businessUserId,
          tenantId: cc.campaign.tenantId,
          campaignId: cc.campaignId,
          type: "qualification",
          source: "score_threshold",
          content: JSON.stringify({ score, threshold, breakdown }).slice(0, 2000),
        },
      })
      .catch(() => {});
  }

  if (qualifiedByScoreApplied) {
    enqueueQualifiedCrmPush(prismaClient, campaignContactId);
  }

  return {
    updated: true,
    status: nextStatus,
    previousStatus: cc.status,
    score,
    qualifiedByScore: qualifiedByScoreApplied,
  };
}

/**
 * Best display status from DB row + comm logs (does not write).
 * Use when UI should reflect funnel progress before DB reconcile runs.
 */
export function resolveCampaignContactDisplayStatus(campaignContact, commLogs = []) {
  if (
    campaignContact?.status === "QUALIFIED" ||
    campaignContact?.qualifiedAt
  ) {
    return "QUALIFIED";
  }

  if (
    campaignContact?.status &&
    TERMINAL_CAMPAIGN_CONTACT_STATUSES.has(campaignContact.status)
  ) {
    return campaignContact.status;
  }

  const derived = deriveCampaignContactStatus(campaignContact, commLogs);
  const currentRank = statusRank(campaignContact?.status);
  const derivedRank = statusRank(derived);

  if (derivedRank > currentRank) {
    return derived;
  }

  return campaignContact?.status ?? derived;
}

/** Reconcile stale PENDING / IN_OUTREACH rows from comm log history. */
export async function reconcileCampaignContactStatusesForCampaign(
  prismaClient,
  campaignId
) {
  if (!campaignId) {
    return { checked: 0, updated: 0 };
  }

  const contacts = await prismaClient.campaignContact.findMany({
    where: {
      campaignId,
      status: { in: ["PENDING", "IN_OUTREACH"] },
    },
    select: { id: true },
  });

  let updated = 0;
  for (const cc of contacts) {
    const result = await syncCampaignContactStatus(prismaClient, cc.id);
    if (result.updated) updated += 1;
  }

  return { checked: contacts.length, updated };
}

export async function syncCampaignContactStatusForLog(prismaClient, log) {
  const campaignContactId =
    log?.campaignContactId ?? log?.prospectId ?? null;
  if (!campaignContactId) {
    return { updated: false, reason: "missing_contact_campaign_id" };
  }
  return syncCampaignContactStatus(prismaClient, campaignContactId);
}

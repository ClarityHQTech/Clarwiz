import { TERMINAL_CONTACT_CAMPAIGN_STATUSES } from "@/lib/contactCampaignStatus";
import { isProspectReply } from "@/lib/commLogEngagement";

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
export function deriveContactCampaignStatus(contactCampaign, commLogs = []) {
  if (contactCampaign?.status === "QUALIFIED" || contactCampaign?.qualifiedAt) {
    return "QUALIFIED";
  }

  if (
    contactCampaign?.status &&
    TERMINAL_CONTACT_CAMPAIGN_STATUSES.has(contactCampaign.status)
  ) {
    return contactCampaign.status;
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

/**
 * Update ContactCampaign.status when comm activity advances the funnel.
 * Never downgrades (e.g. REPLIED → IN_OUTREACH). Respects terminal statuses.
 */
export async function syncContactCampaignStatus(prismaClient, contactCampaignId) {
  if (!contactCampaignId) {
    return { updated: false, reason: "missing_id" };
  }

  const cc = await prismaClient.contactCampaign.findUnique({
    where: { id: contactCampaignId },
    include: {
      commLogs: {
        select: {
          status: true,
          message: true,
          openedAt: true,
          ctaClickedAt: true,
          responseType: true,
          responseContent: true,
          channel: true,
        },
      },
    },
  });

  if (!cc) {
    return { updated: false, reason: "not_found" };
  }

  if (
    cc.status === "QUALIFIED" ||
    cc.qualifiedAt ||
    (cc.status && TERMINAL_CONTACT_CAMPAIGN_STATUSES.has(cc.status))
  ) {
    return { updated: false, status: cc.status, reason: "terminal" };
  }

  const nextStatus = deriveContactCampaignStatus(cc, cc.commLogs);

  if (nextStatus === cc.status) {
    return { updated: false, status: cc.status };
  }

  const currentRank = statusRank(cc.status);
  const nextRank = statusRank(nextStatus);

  if (nextRank <= currentRank && cc.status !== "PENDING") {
    return { updated: false, status: cc.status, reason: "no_downgrade" };
  }

  await prismaClient.contactCampaign.update({
    where: { id: contactCampaignId },
    data: { status: nextStatus },
  });

  return { updated: true, status: nextStatus, previousStatus: cc.status };
}

/**
 * Best display status from DB row + comm logs (does not write).
 * Use when UI should reflect funnel progress before DB reconcile runs.
 */
export function resolveContactCampaignDisplayStatus(contactCampaign, commLogs = []) {
  if (
    contactCampaign?.status === "QUALIFIED" ||
    contactCampaign?.qualifiedAt
  ) {
    return "QUALIFIED";
  }

  if (
    contactCampaign?.status &&
    TERMINAL_CONTACT_CAMPAIGN_STATUSES.has(contactCampaign.status)
  ) {
    return contactCampaign.status;
  }

  const derived = deriveContactCampaignStatus(contactCampaign, commLogs);
  const currentRank = statusRank(contactCampaign?.status);
  const derivedRank = statusRank(derived);

  if (derivedRank > currentRank) {
    return derived;
  }

  return contactCampaign?.status ?? derived;
}

/** Reconcile stale PENDING / IN_OUTREACH rows from comm log history. */
export async function reconcileContactCampaignStatusesForCampaign(
  prismaClient,
  campaignId
) {
  if (!campaignId) {
    return { checked: 0, updated: 0 };
  }

  const contacts = await prismaClient.contactCampaign.findMany({
    where: {
      campaignId,
      status: { in: ["PENDING", "IN_OUTREACH"] },
    },
    select: { id: true },
  });

  let updated = 0;
  for (const cc of contacts) {
    const result = await syncContactCampaignStatus(prismaClient, cc.id);
    if (result.updated) updated += 1;
  }

  return { checked: contacts.length, updated };
}

export async function syncContactCampaignStatusForLog(prismaClient, log) {
  const contactCampaignId =
    log?.contactCampaignId ?? log?.prospectId ?? null;
  if (!contactCampaignId) {
    return { updated: false, reason: "missing_contact_campaign_id" };
  }
  return syncContactCampaignStatus(prismaClient, contactCampaignId);
}

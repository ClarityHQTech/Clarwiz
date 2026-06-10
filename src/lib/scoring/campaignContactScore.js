import { isProspectReply } from "@/lib/commLogEngagement";

/** Engagement score is always clamped to this range. */
export const MAX_SCORE = 100;
export const MIN_SCORE = 0;

/** Default auto-qualify threshold (overridable per campaign via Campaign.qualificationThreshold). */
export const DEFAULT_SCORE_THRESHOLD = 90;

/** Points awarded per engagement signal. Reply points come from inferred intent. */
export const SCORE_WEIGHTS = {
  emailOpened: 10,
  whatsappDelivered: 5,
  whatsappRead: 10,
  ctaClicked: 15,
  linkedinConnected: 20,
};

/** Reply points by LLM-inferred intent. Negative replies subtract. */
export const REPLY_INTENT_POINTS = {
  positive: 45,
  neutral: 15,
  negative: -30,
};

/** Calendly booking is an automatic qualification — pin the score to the max. */
const CALENDLY_QUALIFY_REASONS = new Set([
  "calendly_booked",
  "calendly_link_clicked",
]);

function clampScore(value) {
  if (!Number.isFinite(value)) return MIN_SCORE;
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(value)));
}

/** Read the stored reply intent ("positive" | "neutral" | "negative") off a comm log. */
export function getStoredReplyIntent(log) {
  const meta = log?.deliveryMeta;
  const intent = meta && typeof meta === "object" ? meta.replyIntent : null;
  if (intent === "positive" || intent === "neutral" || intent === "negative") {
    return intent;
  }
  return null;
}

/**
 * Deterministically compute a 0-100 engagement score from comm log history.
 * Idempotent: recomputing from the same logs always yields the same score.
 *
 * Reply scoring is "intelligent" — points come from the intent inferred at
 * reply time and stored on the log's deliveryMeta. Replies not yet classified
 * default to neutral so engagement is still reflected.
 */
export function computeCampaignContactScore({
  campaignContact,
  commLogs = [],
  threshold = DEFAULT_SCORE_THRESHOLD,
} = {}) {
  // A booked Calendly meeting is an automatic qualification.
  if (
    campaignContact?.qualifiedReason &&
    CALENDLY_QUALIFY_REASONS.has(campaignContact.qualifiedReason)
  ) {
    return {
      score: MAX_SCORE,
      breakdown: [
        { label: "Calendly meeting booked", points: MAX_SCORE, kind: "calendly" },
      ],
      qualifiedByScore: true,
    };
  }

  const logs = commLogs ?? [];
  const breakdown = [];

  for (const log of logs) {
    if (!log || log.status === "skipped") continue;
    const channel = log.channel ?? "email";

    if (log.openedAt) {
      const isWhatsApp = channel === "whatsapp";
      breakdown.push({
        label: isWhatsApp ? "WhatsApp message read" : "Email opened",
        points: isWhatsApp ? SCORE_WEIGHTS.whatsappRead : SCORE_WEIGHTS.emailOpened,
        kind: "open",
        channel,
        logId: log.id ?? null,
      });
    }

    if (channel === "whatsapp" && log.deliveredAt) {
      breakdown.push({
        label: "WhatsApp delivered",
        points: SCORE_WEIGHTS.whatsappDelivered,
        kind: "delivered",
        channel,
        logId: log.id ?? null,
      });
    }

    if (log.ctaClickedAt) {
      breakdown.push({
        label: "Link / CTA clicked",
        points: SCORE_WEIGHTS.ctaClicked,
        kind: "click",
        channel,
        logId: log.id ?? null,
      });
    }

    if (log.responseType === "connected") {
      breakdown.push({
        label: "LinkedIn connection accepted",
        points: SCORE_WEIGHTS.linkedinConnected,
        kind: "connected",
        channel,
        logId: log.id ?? null,
      });
    }

    if (isProspectReply(log)) {
      const intent = getStoredReplyIntent(log) ?? "neutral";
      breakdown.push({
        label:
          intent === "positive"
            ? "Positive reply"
            : intent === "negative"
              ? "Negative reply"
              : "Reply received",
        points: REPLY_INTENT_POINTS[intent],
        kind: "reply",
        intent,
        channel,
        logId: log.id ?? null,
      });
    }
  }

  const rawScore = breakdown.reduce((sum, item) => sum + (item.points ?? 0), 0);
  const score = clampScore(rawScore);

  return {
    score,
    breakdown,
    qualifiedByScore: score >= threshold,
  };
}

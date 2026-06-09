import { getAppBaseUrl } from "@/lib/appUrl";

/**
 * Build tracked booking URL for a prospect on a campaign.
 */
export function buildTrackedBookingUrl(campaignId, prospectId) {
  const base = getAppBaseUrl();
  return `${base}/api/campaigns/${campaignId}/book?prospectId=${encodeURIComponent(prospectId)}`;
}

/**
 * Highest outbound stage sent so far (for next-stage booking link rules).
 */
export function getMaxOutboundStage(commHistory) {
  let max = 0;
  for (const log of commHistory ?? []) {
    if (log.status === "skipped") continue;
    if (log.stage != null && log.stage > max) max = log.stage;
  }
  return max;
}

/**
 * Next stage number for outbound (max sent + 1, minimum 1).
 */
export function getNextOutboundStage(commHistory) {
  const max = getMaxOutboundStage(commHistory);
  return Math.max(1, max + 1);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCalendlyUrlBase(calendlyBookingUrl) {
  try {
    const parsed = new URL(calendlyBookingUrl.trim());
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

/**
 * Swap raw Calendly URLs (or placeholders) for the Clarwiz tracked redirect.
 */
export function substituteRawCalendlyUrls(message, calendlyBookingUrl, trackedUrl) {
  if (!message?.trim() || !trackedUrl || !calendlyBookingUrl?.trim()) {
    return message;
  }

  let result = message;
  result = result.replace(/\[Calendly link\]/gi, trackedUrl);
  result = result.replace(/\[booking link\]/gi, trackedUrl);

  const variants = new Set([calendlyBookingUrl.trim()]);
  const base = getCalendlyUrlBase(calendlyBookingUrl);
  if (base) variants.add(base);

  for (const variant of variants) {
    const escaped = escapeRegExp(variant);
    const pattern = new RegExp(
      `${escaped}(?:\\?[^\\s]*)?(?=[\\s.,;:!?\\)]|$)`,
      "gi"
    );
    result = result.replace(pattern, trackedUrl);
  }

  if (base) {
    try {
      const path = new URL(base).pathname.replace(/\/$/, "");
      const hostPath = escapeRegExp(`calendly.com${path}`);
      const pattern = new RegExp(
        `https?://${hostPath}(?:\\?[^\\s]*)?(?=[\\s.,;:!?\\)]|$)`,
        "gi"
      );
      result = result.replace(pattern, trackedUrl);
    } catch {
      // Keep prior substitutions only.
    }
  }

  return result;
}

/**
 * Append tracked booking link when stage >= 2 or reply follow-up (all channels).
 */
export function appendBookingLinkIfAllowed({
  message,
  campaign,
  prospectId,
  stage,
  isReplyFollowUp,
}) {
  if (!campaign?.calendlyBookingUrl?.trim()) return message;
  if (!message?.trim()) return message;
  if (!campaign.id || !prospectId) return message;

  const stageNum = Number(stage) || 1;
  const allowLink = isReplyFollowUp || stageNum >= 2;
  if (!allowLink) return message;

  const trackedUrl = buildTrackedBookingUrl(campaign.id, prospectId);
  let result = substituteRawCalendlyUrls(
    message,
    campaign.calendlyBookingUrl,
    trackedUrl
  );

  if (result.includes(trackedUrl)) {
    return result;
  }

  return `${result.trim()}\n\nBook a time here: ${trackedUrl}`;
}

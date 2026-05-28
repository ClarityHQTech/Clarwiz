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

/**
 * Append tracked booking link when stage >= 2 or reply follow-up.
 */
export function appendBookingLinkIfAllowed({
  message,
  campaign,
  prospectId,
  stage,
  isReplyFollowUp,
  channel,
}) {
  if (!campaign?.calendlyBookingUrl?.trim()) return message;
  if (!message?.trim()) return message;

  const stageNum = Number(stage) || 1;
  const allowLink = isReplyFollowUp || stageNum >= 2;
  if (!allowLink) return message;

  if (channel === "whatsapp") {
    return message;
  }

  let bookingUrl = campaign.calendlyBookingUrl.trim();
  try {
    const url = new URL(bookingUrl);
    url.searchParams.set("utm_source", "clarwiz");
    url.searchParams.set("utm_campaign", campaign.id);
    if (prospectId) {
      url.searchParams.set("utm_content", prospectId);
    }
    bookingUrl = url.toString();
  } catch {
    // Keep original URL if not parseable.
  }

  if (message.includes(bookingUrl) || message.includes(campaign.calendlyBookingUrl)) {
    return message;
  }

  return `${message.trim()}\n\nBook a time here: ${bookingUrl}`;
}

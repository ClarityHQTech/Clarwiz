import { getAppBaseUrl } from "@/lib/appUrl";
import { substituteRawCalendlyUrls } from "@/lib/execution/appendBookingLink";

/**
 * Tracked redirect for an AE Assist NBA email scheduling CTA.
 */
export function buildAssistTrackedBookingUrl(dealId, { nbaId } = {}) {
  const base = getAppBaseUrl();
  const params = new URLSearchParams();
  if (nbaId) params.set("nbaId", nbaId);
  const qs = params.toString();
  return `${base}/api/assist/deal/${encodeURIComponent(dealId)}/book${qs ? `?${qs}` : ""}`;
}

/**
 * Append (or substitute) a tracked Calendly booking link in NBA email HTML.
 * Mirrors TOFU appendBookingLink — the LLM may include a raw URL or placeholder;
 * we normalize to the tracked assist redirect.
 */
export function appendAssistBookingLink({
  html,
  calendlyBookingUrl,
  dealId,
  nbaId,
}) {
  if (!html?.trim() || !calendlyBookingUrl?.trim() || !dealId) return html;

  const trackedUrl = buildAssistTrackedBookingUrl(dealId, { nbaId });
  let result = substituteRawCalendlyUrls(html, calendlyBookingUrl, trackedUrl);

  if (result.includes(trackedUrl)) return result;

  return (
    `${result.trim()}` +
    `<p style="margin-top:16px"><a href="${trackedUrl}">Schedule a meeting</a></p>`
  );
}

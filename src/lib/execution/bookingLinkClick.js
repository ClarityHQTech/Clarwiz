/**
 * Messaging apps and social crawlers fetch outbound URLs to build link previews.
 * Those GETs must not count as prospect clicks or qualify leads.
 */
const LINK_PREVIEW_BOT_PATTERN =
  /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|embedly|quora link preview|showyoubot|outbrain|pinterest|vkshare|w3c_validator/i;

export function isLinkPreviewBotRequest(request) {
  const method = request.method?.toUpperCase() ?? "GET";
  if (method === "HEAD" || method === "OPTIONS") return true;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent.trim()) return true;

  return LINK_PREVIEW_BOT_PATTERN.test(userAgent);
}

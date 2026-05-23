import { applyTemplateVariables, prospectFirstName } from "@/lib/execution/renderMessage";

const PLACEHOLDER_LINE =
  /^\s*(\[\s*[^\]]+\s*\]|\{\{[^}]+\}\}|<\s*[^>]+\s*>)\s*\.?\s*$/i;

const INLINE_PLACEHOLDER = /\[\s*(your name|name|insert[^\]]*)\s*\]/gi;

const GENERIC_CLOSING_LINES = [
  /^looking forward to (our|the) conversation\.?\s*$/i,
  /^best regards,?\s*$/i,
  /^kind regards,?\s*$/i,
  /^thanks,?\s*$/i,
  /^thank you,?\s*$/i,
  /^cheers,?\s*$/i,
];

/** Most recent prospect reply from comm history (newest first). */
export function getLatestProspectReply(commHistory) {
  for (let i = commHistory.length - 1; i >= 0; i--) {
    const log = commHistory[i];
    if (log.responseType && log.responseContent?.trim()) {
      return log;
    }
  }
  return null;
}

export function isReplyFollowUp(commHistory) {
  return Boolean(getLatestProspectReply(commHistory));
}

function stripPlaceholderLines(text) {
  return text
    .split("\n")
    .filter((line) => !PLACEHOLDER_LINE.test(line))
    .join("\n");
}

function stripGenericOnlyClosing(text) {
  const lines = text.split("\n");
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (!last) {
      lines.pop();
      continue;
    }
    if (GENERIC_CLOSING_LINES.some((re) => re.test(last))) {
      lines.pop();
      continue;
    }
    if (INLINE_PLACEHOLDER.test(last) && last.length < 40) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

function replaceRemainingTokens(text, { prospect, campaign }) {
  return applyTemplateVariables(text, { prospect, campaign });
}

function hasPlaceholderArtifacts(text) {
  if (!text) return true;
  if (/\{\{[^}]+\}\}/.test(text)) return true;
  if (/\[\s*(your name|insert|company name|name)\s*\]/i.test(text)) return true;
  return false;
}

/**
 * Remove template artifacts and enforce human-readable outbound copy.
 */
export function sanitizeOutboundMessage(
  message,
  { prospect, campaign, isReplyFollowUp: replyMode = false } = {}
) {
  if (!message?.trim()) return message;

  let out = message.replace(INLINE_PLACEHOLDER, "");
  out = stripPlaceholderLines(out);
  out = replaceRemainingTokens(out, { prospect, campaign });
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  if (replyMode) {
    out = stripGenericOnlyClosing(out);
    out = out.replace(/Looking forward to our conversation\.?\s*/gi, "");
    out = out.replace(/Best regards,\s*\n?/gi, "");
  }

  return out.trim();
}

/**
 * Minimal human fallback when the model still returns template slop on a reply thread.
 */
export function buildReplyFallbackMessage(latestReply, { prospect, campaign }) {
  const firstName =
    prospect?.firstName?.trim() ||
    prospectFirstName(prospect?.name) ||
    "there";
  const replySnippet = latestReply.responseContent.trim().slice(0, 120);
  const goal = campaign?.goals?.trim() || "connect briefly";

  return sanitizeOutboundMessage(
    `Hi ${firstName} — thanks for getting back to me. I saw your note about "${replySnippet}${replySnippet.length >= 120 ? "…" : ""}". Happy to ${goal.toLowerCase().includes("demo") ? "find 15 minutes for a quick demo" : "keep this practical and answer any questions"}. What time works for you this week?`,
    { prospect, campaign, isReplyFollowUp: true }
  );
}

export function finalizeOutboundMessage({
  message,
  prospect,
  campaign,
  isReplyFollowUp: replyMode,
  latestReply,
}) {
  let out = sanitizeOutboundMessage(message, {
    prospect,
    campaign,
    isReplyFollowUp: replyMode,
  });

  if (
    replyMode &&
    latestReply &&
    (hasPlaceholderArtifacts(out) ||
      out.length < 20 ||
      /^looking forward/i.test(out))
  ) {
    out = buildReplyFallbackMessage(latestReply, { prospect, campaign });
  }

  return out;
}

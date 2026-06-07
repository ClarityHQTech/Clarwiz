/** Prospect-authored replies (count toward reply rate / follow-up). */
export const PROSPECT_REPLY_RESPONSE_TYPE = "reply";

export function isProspectReply(log) {
  return (
    log?.responseType === PROSPECT_REPLY_RESPONSE_TYPE &&
    Boolean(log.responseContent?.trim())
  );
}

export function isLinkedInConnected(log) {
  return log?.responseType === "connected";
}

export function hasProspectReplyInHistory(commHistory = []) {
  return (commHistory ?? []).some(isProspectReply);
}

/** WhatsApp customer service window — 24h from last inbound user message. */
export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function computeWhatsAppWindowExpiry(fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  return new Date(base.getTime() + WHATSAPP_SESSION_WINDOW_MS);
}

export function isWhatsAppSessionWindowOpen(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  const ref = now instanceof Date ? now : new Date(now);
  return exp > ref;
}

function readDeliveryMeta(log) {
  return log?.deliveryMeta && typeof log.deliveryMeta === "object"
    ? log.deliveryMeta
    : {};
}

function latestWhatsAppInboundAt(commHistory = []) {
  const inboundAt = (commHistory ?? [])
    .filter((log) => log.channel === "whatsapp" && hasWhatsAppInboundOnLog(log))
    .map((log) => log.responseAt ?? log.createdAt ?? log.sentAt)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return inboundAt[0] ?? null;
}

/** True when a comm log row carries any sign of an inbound WhatsApp message. */
export function hasWhatsAppInboundOnLog(log) {
  if (!log || log.channel !== "whatsapp") return false;

  const meta = readDeliveryMeta(log);

  if (log.responseType === "reply" && log.responseContent?.trim()) {
    return true;
  }
  if (meta.inboundOnly && log.responseContent?.trim()) {
    return true;
  }
  if (meta.lastInboundMessageId) {
    return true;
  }
  if (Array.isArray(meta.processedInboundIds) && meta.processedInboundIds.length > 0) {
    return true;
  }
  if (log.responseAt && log.responseContent?.trim()) {
    return true;
  }

  return false;
}

export function hasWhatsAppProspectReply(commHistory = []) {
  return (commHistory ?? []).some(hasWhatsAppInboundOnLog);
}

/**
 * Window expiry from the latest inbound WhatsApp message in comm logs.
 * Comm logs win over contact_campaign.whatsapp24hWindowExpiresAt (which can stay stale
 * after logs are deleted or when the DB field was not refreshed yet).
 */
export function resolveWhatsAppWindowExpiresAt(contactCampaign, commHistory = []) {
  const latestInbound = latestWhatsAppInboundAt(commHistory);
  const fromHistory = latestInbound
    ? computeWhatsAppWindowExpiry(latestInbound)
    : null;

  const stored = contactCampaign?.whatsapp24hWindowExpiresAt
    ? new Date(contactCampaign.whatsapp24hWindowExpiresAt)
    : null;
  const storedValid =
    stored && !Number.isNaN(stored.getTime()) ? stored : null;

  if (fromHistory && storedValid) {
    return fromHistory > storedValid ? fromHistory : storedValid;
  }

  return fromHistory ?? storedValid ?? null;
}

export function getWhatsAppSessionWindowState({
  expiresAt,
  now = new Date(),
} = {}) {
  const open = isWhatsAppSessionWindowOpen(expiresAt, now);
  const exp =
    expiresAt instanceof Date
      ? expiresAt
      : expiresAt
        ? new Date(expiresAt)
        : null;

  return {
    windowOpen: open,
    expiresAt:
      exp && !Number.isNaN(exp.getTime()) ? exp.toISOString() : null,
    freeFormAllowed: open,
  };
}

/** Co-pilot / UI eligibility for WhatsApp free-form vs template-only sends. */
export function getWhatsAppCopilotUiState(contactCampaign, commHistory = []) {
  const expiresAt = resolveWhatsAppWindowExpiresAt(contactCampaign, commHistory);
  const windowState = getWhatsAppSessionWindowState({ expiresAt });

  return {
    ...windowState,
    canSendTemplate: true,
    canSendFreeForm: windowState.windowOpen,
  };
}

/**
 * Choose template vs free-form WhatsApp push.
 * Inbound reply in comm history → always free-form (Meta type: "text").
 * @returns {"template"|"freeform"|"none"}
 */
export function resolveWhatsAppSendMode({
  decision,
  prospect,
  commHistory = [],
  forceFreeform = false,
}) {
  const hasMessage = Boolean(decision?.message?.trim());
  const hasReply = hasWhatsAppProspectReply(commHistory);

  if (forceFreeform && hasMessage) {
    return "freeform";
  }

  if (hasReply && hasMessage) {
    return "freeform";
  }

  const windowExpiresAt = resolveWhatsAppWindowExpiresAt(prospect, commHistory);
  const windowOpen = isWhatsAppSessionWindowOpen(windowExpiresAt);
  const hasTemplateId = Boolean(decision?.templateId);

  if (windowOpen && hasMessage) {
    return "freeform";
  }

  if (hasTemplateId) {
    return "template";
  }

  return "none";
}

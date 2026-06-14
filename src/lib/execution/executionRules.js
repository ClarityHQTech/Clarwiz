import {
  getLatestProspectReply,
  isReplyFollowUp,
} from "@/lib/execution/humanizeOutboundMessage";
import {
  DEFAULT_ENABLED_CHANNELS,
  resolveCampaignEnabledChannels,
} from "@/lib/campaignChannels";

/**
 * Runtime helpers for execution-layer constraints.
 *
 * Canonical rules: docs/execution-layer-rules.md
 * Update that document first when changing behavior, then align this module.
 */
export const EXECUTION_RULES_DOC = "docs/execution-layer-rules.md";

/** Channels the execution layer may plan, push, and track. */
export const ACTIVE_EXECUTION_CHANNELS = ["email", "linkedin", "whatsapp"];

function hasContactValue(value) {
  return Boolean(String(value ?? "").trim());
}

/** True when the prospect has the contact detail required for a channel. */
export function hasProspectChannelDetail(prospect, channel) {
  if (!prospect || !channel) return false;
  if (channel === "email") return hasContactValue(prospect.email);
  if (channel === "linkedin") return hasContactValue(prospect.linkedinUrl);
  if (channel === "whatsapp") return hasContactValue(prospect.whatsapp);
  return false;
}

export function availableProspectChannels(prospect, enabledChannels = null) {
  const enabled = enabledChannels ?? DEFAULT_ENABLED_CHANNELS;

  return ACTIVE_EXECUTION_CHANNELS.filter(
    (channel) =>
      enabled.includes(channel) && hasProspectChannelDetail(prospect, channel)
  );
}

/** Campaign-enabled channels that also have contact details on the prospect. */
export function resolveExecutableProspectChannels(campaign, prospect) {
  return availableProspectChannels(
    prospect,
    resolveCampaignEnabledChannels(campaign)
  );
}

export function isExecutableProspectChannel(campaign, prospect, channel) {
  return resolveExecutableProspectChannels(campaign, prospect).includes(channel);
}

export function skipReasonForUnavailableProspectChannels(campaign, prospect) {
  const enabled = resolveCampaignEnabledChannels(campaign);
  if (enabled.length === 0) {
    return "No outreach channels enabled for this campaign";
  }
  return "No contact channels available for this prospect on enabled campaign channels";
}

/**
 * True when a LinkedIn connection request was sent and accepted for this prospect.
 * @see docs/execution-layer-rules.md §2
 */
export function isLinkedInConnectionAccepted(commHistory) {
  return (commHistory ?? []).some((log) => {
    if (log.channel !== "linkedin") return false;
    if (log.responseType === "connected") return true;
    if (log.deliveryMeta?.invitationState === "ACCEPTED") return true;
    if (
      log.deliveryMeta?.action === "send" &&
      ["sent", "queued", "delivered"].includes(log.status)
    ) {
      return true;
    }
    return false;
  });
}

/** LinkedIn DMs require an accepted connection (§2). */
export function canPushLinkedInMessage(commHistory) {
  return isLinkedInConnectionAccepted(commHistory);
}

export function isLinkedInConnectionRequest(decision) {
  return (
    decision?.channel === "linkedin" &&
    decision?.ctaType === "connect_linkedin"
  );
}

/** Connection invite sent but not yet accepted (§2). */
export function hasLinkedInConnectionPending(commHistory) {
  if (isLinkedInConnectionAccepted(commHistory)) return false;
  return (commHistory ?? []).some(
    (log) =>
      log.channel === "linkedin" &&
      ["sent", "queued", "delivered"].includes(log.status) &&
      (log.ctaType === "connect_linkedin" ||
        log.deliveryMeta?.invitationState === "PENDING")
  );
}

export { getWhatsAppCopilotUiState } from "@/lib/whatsappSessionWindow";

/** UI / copilot send eligibility for LinkedIn on a contact thread. */
export function getLinkedInCopilotUiState(commHistory) {
  const connectionAccepted = isLinkedInConnectionAccepted(commHistory);
  const connectionPending = hasLinkedInConnectionPending(commHistory);
  return {
    connectionAccepted,
    connectionPending,
    canSendConnection: !connectionAccepted && !connectionPending,
    canSendMessage: connectionAccepted,
  };
}

/**
 * LinkedIn connection-request note limit (Linkup / LinkedIn).
 * Free accounts: 200 chars; paid up to 300. We cap at 200 for all accounts.
 * @see docs/execution-layer-rules.md §7
 */
export const LINKEDIN_CONNECTION_NOTE_MAX_CHARS = 200;

/** Truncate connection note before Linkup invite (avoids CUSTOM_MESSAGE_TOO_LONG). */
export function truncateLinkedInConnectionNote(message) {
  const trimmed = message?.trim();
  if (!trimmed) return undefined;
  const max = LINKEDIN_CONNECTION_NOTE_MAX_CHARS;
  if (trimmed.length <= max) return trimmed;

  let cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.5) {
    cut = cut.slice(0, lastSpace);
  }
  return cut.trim();
}

/**
 * Reply follow-ups must use the same channel as the latest prospect reply.
 * @see docs/execution-layer-rules.md §13
 */
export function enforceReplyChannelPriority(
  decision,
  commHistory,
  prospectChannels
) {
  if (!decision || decision.skip || !isReplyFollowUp(commHistory)) {
    return decision;
  }

  const latestReply = getLatestProspectReply(commHistory);
  const replyChannel = latestReply?.channel;
  if (replyChannel && prospectChannels.includes(replyChannel)) {
    return { ...decision, channel: replyChannel };
  }

  return decision;
}

/**
 * Block or remap invalid channel decisions (e.g. call, unavailable channel).
 */
export function enforceChannelRules(
  decision,
  prospectChannels,
  commHistory = [],
  enabledChannels = ACTIVE_EXECUTION_CHANNELS
) {
  void commHistory;
  if (!decision || decision.skip) return decision;

  const allowedProspectChannels = prospectChannels.filter((ch) =>
    enabledChannels.includes(ch)
  );

  if (allowedProspectChannels.length === 0) {
    return {
      ...decision,
      skip: true,
      skipReason:
        enabledChannels.length === 0
          ? "No outreach channels enabled for this campaign"
          : "No contact channels available for this prospect on enabled campaign channels",
    };
  }

  let channel = decision.channel;
  const channelIsExecutable =
    channel &&
    ACTIVE_EXECUTION_CHANNELS.includes(channel) &&
    enabledChannels.includes(channel) &&
    allowedProspectChannels.includes(channel);

  if (!channelIsExecutable) {
    channel = allowedProspectChannels[0];
  }

  return { ...decision, channel, skip: false };
}

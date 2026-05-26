/**
 * Runtime helpers for execution-layer constraints.
 *
 * Canonical rules: docs/execution-layer-rules.md
 * Update that document first when changing behavior, then align this module.
 */
export const EXECUTION_RULES_DOC = "docs/execution-layer-rules.md";

/** Channels the execution layer may plan, push, and track. */
export const ACTIVE_EXECUTION_CHANNELS = ["email", "linkedin", "whatsapp"];

export function availableProspectChannels(prospect) {
  const channels = [];
  if (prospect?.email) channels.push("email");
  if (prospect?.linkedinUrl) channels.push("linkedin");
  if (prospect?.whatsapp) channels.push("whatsapp");
  return channels;
}

/**
 * True when a LinkedIn connection request was sent and accepted for this prospect.
 * @see docs/execution-layer-rules.md §2
 */
export function isLinkedInConnectionAccepted(commHistory) {
  return (commHistory ?? []).some(
    (log) =>
      log.channel === "linkedin" &&
      log.ctaType === "connect_linkedin" &&
      (log.responseType === "connected" ||
        log.deliveryMeta?.invitationState === "ACCEPTED")
  );
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

/**
 * Block or remap invalid channel decisions (e.g. call, unavailable channel).
 */
export function enforceChannelRules(decision, prospectChannels, commHistory = []) {
  if (!decision || decision.skip) return decision;

  let channel = decision.channel;
  if (channel === "call" || !ACTIVE_EXECUTION_CHANNELS.includes(channel)) {
    channel = prospectChannels[0] ?? null;
  }
  if (channel && !prospectChannels.includes(channel)) {
    channel = prospectChannels[0] ?? null;
  }
  if (!channel) {
    return {
      ...decision,
      skip: true,
      skipReason:
        "No supported contact channel available (email, linkedin, whatsapp only)",
    };
  }

  if (
    channel === "linkedin" &&
    !isLinkedInConnectionRequest(decision) &&
    !canPushLinkedInMessage(commHistory)
  ) {
    return {
      ...decision,
      skip: true,
      skipReason:
        "LinkedIn message blocked: send a connection request and wait for acceptance before DM (see docs/execution-layer-rules.md §2)",
      channel: "linkedin",
    };
  }

  return { ...decision, channel };
}

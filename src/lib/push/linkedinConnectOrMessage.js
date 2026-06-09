import {
  canPushLinkedInMessage,
  hasLinkedInConnectionPending,
} from "@/lib/execution/executionRules";
import { linkupCheckInvitation } from "@/lib/linkupApi";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { normalizeLinkedInProfileUrl } from "@/lib/linkedinProfileUrl";
import { buildPushResult } from "@/lib/push/normalizePushResult";
import { pushLinkedInConnectionRequest } from "@/lib/push/linkedinConnection";
import { pushLinkedInMessage } from "@/lib/push/linkedinMessage";

function isLinkedInAlreadyConnected(data) {
  if (!data) return false;
  return (
    data.invitation_state === "ACCEPTED" || data.invitation_type === "CONNECTED"
  );
}

function sumCredits(...values) {
  return values.reduce((sum, n) => sum + (Number(n) || 0), 0);
}

/**
 * Reuse invitation state from prior comm logs — avoids a check_invitation credit.
 */
function getCachedInvitationState(commHistory) {
  for (let i = (commHistory ?? []).length - 1; i >= 0; i--) {
    const log = commHistory[i];
    if (log.channel !== "linkedin") continue;
    if (log.responseType === "connected") return "ACCEPTED";
    const state = log.deliveryMeta?.invitationState;
    if (state) return state;
  }
  return null;
}

/**
 * Cold outreach: trust a successful invite when Linkup returns an invitation URN.
 * Check status only when invite failed or "succeeded" without an URN (already-connected no-op).
 */
function inviteNeedsStatusCheck(connResult) {
  if (connResult.skippedSend) return false;
  if (connResult.status === "failed") return true;
  if (connResult.status !== "sent" && connResult.status !== "queued") {
    return false;
  }
  const meta = connResult.deliveryMeta ?? {};
  return !meta.invitationUrn;
}

async function fetchInvitationStatus(tenantId, profileUrl) {
  const integration = await getLinkedInIntegrationWithAccountId(tenantId);
  if (
    !integration ||
    integration.status !== "connected" ||
    !integration.linkupAccountIdPlain
  ) {
    return { data: null, creditsConsumed: 0 };
  }

  const check = await linkupCheckInvitation({
    accountId: integration.linkupAccountIdPlain,
    profileUrl,
  });
  return {
    data: check.data ?? {},
    creditsConsumed: check.metadata?.credits_consumed ?? 1,
  };
}

async function sendDmWhenAlreadyConnected({
  tenantId,
  prospect,
  profileUrl,
  dmMessage,
  priorCredits = 0,
  connectionRequestError = null,
}) {
  const messageText = dmMessage?.trim();
  if (!messageText) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: "linkup",
      deliveryMeta: {
        invitationState: "ACCEPTED",
        connectionCheckFallback: true,
        linkupCreditsUsed: priorCredits,
        error: "already_connected_no_dm_message",
      },
      error:
        "Already connected on LinkedIn — add a message to send instead of a connection request",
    });
  }

  const msgResult = await pushLinkedInMessage({
    tenantId,
    prospect,
    message: messageText,
    profileUrl,
  });

  if (msgResult.status !== "sent" && msgResult.status !== "queued") {
    return msgResult;
  }

  return {
    ...msgResult,
    deliveryMeta: {
      ...msgResult.deliveryMeta,
      connectionCheckFallback: true,
      connectionRequestSkipped: true,
      connectionRequestError,
      invitationState: "ACCEPTED",
      linkupCreditsUsed: sumCredits(
        priorCredits,
        msgResult.deliveryMeta?.creditsConsumed
      ),
    },
    deliveryMessage:
      "Already connected on LinkedIn — your message was sent instead of a connection request.",
  };
}

function buildPendingInviteResult({
  profileUrl,
  invitationData,
  priorCredits = 0,
  connectionRequestError = null,
}) {
  return buildPushResult({
    status: "sent",
    deliveryProvider: "linkup",
    deliveryMeta: {
      action: "invite",
      profileUrl,
      invitationState: "PENDING",
      invitationType: invitationData?.invitation_type ?? null,
      invitationId: invitationData?.invitation_id ?? null,
      memberDistance: invitationData?.member_distance ?? null,
      connectionCheckFallback: Boolean(connectionRequestError),
      connectionRequestError,
      linkupCreditsUsed: priorCredits,
    },
    deliveryMessage: "LinkedIn connection request already pending.",
  });
}

/**
 * After a failed or ambiguous invite, spend 1 check_invitation credit and route accordingly.
 */
async function resolveAmbiguousConnectionAttempt({
  tenantId,
  prospect,
  profileUrl,
  dmMessage,
  connResult,
}) {
  const priorCredits = connResult.deliveryMeta?.creditsConsumed ?? 0;
  let invitationData;
  let checkCredits = 0;

  try {
    const check = await fetchInvitationStatus(tenantId, profileUrl);
    invitationData = check.data;
    checkCredits = check.creditsConsumed;
  } catch {
    return connResult;
  }

  const creditsSoFar = sumCredits(priorCredits, checkCredits);

  if (isLinkedInAlreadyConnected(invitationData)) {
    return sendDmWhenAlreadyConnected({
      tenantId,
      prospect,
      profileUrl,
      dmMessage,
      priorCredits: creditsSoFar,
      connectionRequestError: connResult.deliveryMeta?.error ?? connResult.error,
    });
  }

  if (invitationData?.invitation_state === "PENDING") {
    return buildPendingInviteResult({
      profileUrl,
      invitationData,
      priorCredits: creditsSoFar,
      connectionRequestError: connResult.deliveryMeta?.error ?? connResult.error,
    });
  }

  return {
    ...connResult,
    deliveryMeta: {
      ...connResult.deliveryMeta,
      linkupCreditsUsed: creditsSoFar,
    },
  };
}

/**
 * LinkedIn outreach (credit-aware):
 * - Known connected (comm logs) → DM only (1 credit)
 * - Known pending → no API call
 * - Default cold path → invite first (1 credit); check_invitation only on failure or
 *   invite "success" without invitation_urn (already-connected no-op)
 */
export async function pushLinkedInConnectOrMessage({
  tenantId,
  prospect,
  connectionMessage,
  dmMessage,
  profileUrl,
  commHistory,
}) {
  const linkedinUrl = normalizeLinkedInProfileUrl(
    profileUrl ?? prospect.linkedinUrl
  );

  if (canPushLinkedInMessage(commHistory)) {
    return pushLinkedInMessage({
      tenantId,
      prospect,
      message: dmMessage ?? connectionMessage,
      profileUrl: linkedinUrl,
    });
  }

  if (hasLinkedInConnectionPending(commHistory)) {
    return buildPendingInviteResult({
      profileUrl: linkedinUrl,
      invitationData: { invitation_state: "PENDING" },
      priorCredits: 0,
    });
  }

  const cachedState = getCachedInvitationState(commHistory);
  if (cachedState === "ACCEPTED") {
    return sendDmWhenAlreadyConnected({
      tenantId,
      prospect,
      profileUrl: linkedinUrl,
      dmMessage: dmMessage ?? connectionMessage,
      priorCredits: 0,
    });
  }
  if (cachedState === "PENDING") {
    return buildPendingInviteResult({
      profileUrl: linkedinUrl,
      invitationData: { invitation_state: "PENDING" },
      priorCredits: 0,
    });
  }

  const connResult = await pushLinkedInConnectionRequest({
    tenantId,
    prospect,
    message: connectionMessage,
    profileUrl: linkedinUrl,
  });

  if (connResult.skippedSend) {
    return connResult;
  }

  if (!inviteNeedsStatusCheck(connResult)) {
    return {
      ...connResult,
      deliveryMeta: {
        ...connResult.deliveryMeta,
        linkupCreditsUsed: connResult.deliveryMeta?.creditsConsumed ?? 1,
      },
    };
  }

  return resolveAmbiguousConnectionAttempt({
    tenantId,
    prospect,
    profileUrl: linkedinUrl,
    dmMessage: dmMessage ?? connectionMessage,
    connResult,
  });
}

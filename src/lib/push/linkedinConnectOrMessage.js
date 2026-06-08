import { canPushLinkedInMessage } from "@/lib/execution/executionRules";
import { linkupCheckInvitation } from "@/lib/linkupApi";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { normalizeLinkedInProfileUrl } from "@/lib/linkedinProfileUrl";
import { buildPushResult } from "@/lib/push/normalizePushResult";
import { pushLinkedInConnectionRequest } from "@/lib/push/linkedinConnection";
import { pushLinkedInMessage } from "@/lib/push/linkedinMessage";

/**
 * After a failed connection request, check Linkup invitation status and either
 * send a DM (already connected) or record a pending invite.
 */
async function resolveFailedConnectionRequest({
  tenantId,
  prospect,
  profileUrl,
  dmMessage,
  connResult,
}) {
  const integration = await getLinkedInIntegrationWithAccountId(tenantId);
  if (
    !integration ||
    integration.status !== "connected" ||
    !integration.linkupAccountIdPlain
  ) {
    return connResult;
  }

  let check;
  try {
    check = await linkupCheckInvitation({
      accountId: integration.linkupAccountIdPlain,
      profileUrl,
    });
  } catch {
    return connResult;
  }

  const data = check.data ?? {};
  const state = data.invitation_state;
  const connMeta = connResult.deliveryMeta ?? {};

  if (state === "ACCEPTED") {
    const messageText = dmMessage?.trim();
    if (!messageText) {
      return buildPushResult({
        status: "failed",
        deliveryProvider: "linkup",
        deliveryMeta: {
          ...connMeta,
          invitationState: state,
          invitationType: data.invitation_type ?? null,
          connectionCheckFallback: true,
          error: "already_connected_no_dm_message",
        },
        error: "Already connected on LinkedIn but no message to send",
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
        connectionRequestFailed: true,
        connectionRequestError: connMeta.error ?? connResult.error ?? null,
        invitationState: state,
        invitationType: data.invitation_type ?? null,
      },
      deliveryMessage: "LinkedIn message sent (already connected).",
    };
  }

  if (state === "PENDING") {
    return buildPushResult({
      status: "sent",
      deliveryProvider: "linkup",
      deliveryMeta: {
        action: "invite",
        profileUrl,
        invitationState: state,
        invitationType: data.invitation_type ?? null,
        invitationId: data.invitation_id ?? null,
        memberDistance: data.member_distance ?? null,
        connectionCheckFallback: true,
        connectionRequestError: connMeta.error ?? connResult.error ?? null,
      },
      deliveryMessage: "LinkedIn connection request already pending.",
    });
  }

  return connResult;
}

/**
 * LinkedIn outreach: try connection request first; on API failure, check invitation
 * status and send a DM when already connected (Linkup cannot DM without a connection).
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

  const connResult = await pushLinkedInConnectionRequest({
    tenantId,
    prospect,
    message: connectionMessage,
    profileUrl: linkedinUrl,
  });

  if (
    connResult.status === "sent" ||
    connResult.status === "queued" ||
    connResult.skippedSend
  ) {
    return connResult;
  }

  return resolveFailedConnectionRequest({
    tenantId,
    prospect,
    profileUrl: linkedinUrl,
    dmMessage: dmMessage ?? connectionMessage,
    connResult,
  });
}

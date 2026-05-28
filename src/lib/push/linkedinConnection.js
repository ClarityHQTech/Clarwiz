import { truncateLinkedInConnectionNote } from "@/lib/execution/executionRules";
import { linkupSendConnectionRequest } from "@/lib/linkupApi";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { normalizeLinkedInProfileUrl } from "@/lib/linkedinProfileUrl";
import { buildPushResult, buildSkippedPush } from "@/lib/push/normalizePushResult";

/**
 * Send a LinkedIn connection request via LinkupAPI (POST /v2/network, action invite).
 */
export async function pushLinkedInConnectionRequest({
  tenantId,
  prospect,
  message,
  profileUrl,
}) {
  const integration = await getLinkedInIntegrationWithAccountId(tenantId);
  if (
    !integration ||
    integration.status !== "connected" ||
    !integration.linkupAccountIdPlain
  ) {
    return buildSkippedPush("linkedin_not_connected", "linkup");
  }

  const linkedinUrl = normalizeLinkedInProfileUrl(
    profileUrl ?? prospect.linkedinUrl
  );
  if (!linkedinUrl) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: "linkup",
      deliveryMeta: { error: "missing_linkedin_url" },
      error: `Prospect ${prospect.name} has no LinkedIn profile URL`,
    });
  }

  try {
    const note = truncateLinkedInConnectionNote(message);
    const apiResult = await linkupSendConnectionRequest({
      accountId: integration.linkupAccountIdPlain,
      profileUrl: linkedinUrl,
      message: note,
    });

    const data = apiResult.data ?? {};
    return buildPushResult({
      status: "sent",
      deliveryProvider: "linkup",
      deliveryMeta: {
        action: "invite",
        profileUrl: linkedinUrl,
        connectionNoteTruncated:
          Boolean(message?.trim()) &&
          message.trim().length > (note?.length ?? 0),
        invitationUrn: data.invitation_urn ?? null,
        profileUrn: data.profile_urn ?? null,
        publicIdentifier: data.public_identifier ?? null,
        creditsConsumed: apiResult.metadata?.credits_consumed ?? null,
      },
      deliveryMessage: "LinkedIn connection request sent.",
    });
  } catch (err) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: "linkup",
      deliveryMeta: {
        error: err.message,
        code: err.code ?? null,
        profileUrl: linkedinUrl,
        sendFailed: true,
      },
      error: err.message,
    });
  }
}

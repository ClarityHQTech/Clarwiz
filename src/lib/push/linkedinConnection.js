import { linkupSendConnectionRequest } from "@/lib/linkupApi";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { normalizeLinkedInProfileUrl } from "@/lib/linkedinProfileUrl";
import { buildPushResult, buildSkippedPush } from "@/lib/push/normalizePushResult";

/**
 * Send a LinkedIn connection request via LinkupAPI (POST /v2/network, action invite).
 */
export async function pushLinkedInConnectionRequest({
  userId,
  prospect,
  message,
  profileUrl,
}) {
  const integration = await getLinkedInIntegrationWithAccountId(userId);
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
    const apiResult = await linkupSendConnectionRequest({
      accountId: integration.linkupAccountIdPlain,
      profileUrl: linkedinUrl,
      message: message?.trim() || undefined,
    });

    const data = apiResult.data ?? {};
    return buildPushResult({
      status: "sent",
      deliveryProvider: "linkup",
      deliveryMeta: {
        action: "invite",
        profileUrl: linkedinUrl,
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

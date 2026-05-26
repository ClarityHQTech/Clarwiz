import { linkupSendMessage } from "@/lib/linkupApi";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { normalizeLinkedInProfileUrl } from "@/lib/linkedinProfileUrl";
import { buildPushResult, buildSkippedPush } from "@/lib/push/normalizePushResult";

/**
 * Send a LinkedIn direct message via LinkupAPI (POST /v2/messages, action send).
 */
export async function pushLinkedInMessage({
  userId,
  prospect,
  message,
  profileUrl,
  mediaLink,
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

  const messageText = message?.trim();
  if (!messageText) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: "linkup",
      deliveryMeta: { error: "empty_message" },
      error: "LinkedIn message text is required",
    });
  }

  try {
    const apiResult = await linkupSendMessage({
      accountId: integration.linkupAccountIdPlain,
      profileUrl: linkedinUrl,
      messageText,
      mediaLink,
    });

    const data = apiResult.data ?? {};
    return buildPushResult({
      status: "sent",
      deliveryProvider: "linkup",
      deliveryMeta: {
        action: "send",
        profileUrl: linkedinUrl,
        entityUrn: data.entityUrn ?? null,
        conversationId: data.conversation_id ?? null,
        deliveredAt: data.deliveredAt ?? null,
        creditsConsumed: apiResult.metadata?.credits_consumed ?? null,
      },
      deliveryMessage: "LinkedIn message sent.",
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

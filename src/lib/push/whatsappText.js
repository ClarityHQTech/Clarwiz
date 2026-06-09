import {
  sendInteraktText,
  splitPhoneNumber,
} from "@/lib/interaktApi";
import { sendTextMessage } from "@/lib/metaWhatsAppApi";
import {
  getDecryptedAccessToken,
  getWhatsAppIntegration,
} from "@/lib/whatsappIntegration";
import { buildPushResult, buildSkippedPush } from "@/lib/push/normalizePushResult";

/**
 * Send a free-form WhatsApp text message (customer service window only).
 */
export async function pushWhatsAppText({
  tenantId,
  prospect,
  message,
  commLogId,
}) {
  const integration = await getWhatsAppIntegration(tenantId);
  if (!integration || integration.status !== "connected") {
    return buildSkippedPush("whatsapp_not_connected");
  }

  const phone = prospect.whatsapp?.trim();
  const body = message?.trim();
  if (!phone) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: { error: "missing_whatsapp" },
      error: `Prospect ${prospect.name} has no WhatsApp number`,
    });
  }
  if (!body) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: { error: "missing_message_body" },
      error: "WhatsApp message body is required",
    });
  }

  const callbackData = commLogId
    ? JSON.stringify({ commLogId })
    : undefined;

  try {
    if (integration.mode === "interakt") {
      const apiKey = await getDecryptedAccessToken(tenantId);
      const { countryCode, phoneNumber } = splitPhoneNumber(phone);
      const result = await sendInteraktText({
        apiKey,
        countryCode,
        phoneNumber,
        body,
        callbackData,
      });

      return buildPushResult({
        status: "sent",
        deliveryProvider: "interakt",
        renderedMessage: body,
        deliveryMeta: {
          messageId: result.id ?? result.message_id ?? null,
          wamid: result.id ?? result.message_id ?? null,
          phone,
          sendMode: "freeform",
          renderedMessage: body,
          callbackData: callbackData ?? null,
        },
        deliveryMessage: result.message ?? "WhatsApp message sent via Interakt.",
      });
    }

    if (integration.mode !== "meta") {
      return buildSkippedPush("whatsapp_mode_unsupported");
    }

    const accessToken = await getDecryptedAccessToken(tenantId);
    if (!accessToken || !integration.phoneNumberId) {
      return buildSkippedPush("whatsapp_meta_not_configured", "meta");
    }

    const result = await sendTextMessage({
      phoneNumberId: integration.phoneNumberId,
      accessToken,
      to: phone,
      body,
      previewUrl: /https?:\/\//i.test(body),
      callbackData,
    });

    const messageId = result?.messages?.[0]?.id ?? null;

    return buildPushResult({
      status: "sent",
      deliveryProvider: "meta",
      renderedMessage: body,
      deliveryMeta: {
        messageId,
        wamid: messageId,
        phone,
        sendMode: "freeform",
        renderedMessage: body,
        api: "messages",
        callbackData: callbackData ?? null,
      },
      deliveryMessage: "WhatsApp service message sent via Meta.",
    });
  } catch (err) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: integration.mode === "interakt" ? "interakt" : "meta",
      deliveryMeta: {
        error: err.message,
        sendMode: "freeform",
        sendFailed: true,
      },
      error: err.message,
    });
  }
}

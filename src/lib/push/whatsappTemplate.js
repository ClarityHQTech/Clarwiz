import { prisma } from "@/lib/prisma";
import {
  sendInteraktTemplate,
  splitPhoneNumber,
} from "@/lib/interaktApi";
import {
  sendMarketingTemplateMessage,
  sendTemplateMessage,
} from "@/lib/metaWhatsAppApi";
import {
  getDecryptedAccessToken,
  getWhatsAppIntegration,
} from "@/lib/whatsappIntegration";
import {
  buildWhatsAppTemplateParameters,
  countWhatsAppNumberedVariables,
  defaultWhatsAppVariableMapping,
  normalizeWhatsAppVariableMapping,
  parseWhatsAppTemplateVariableSlots,
} from "@/lib/whatsappTemplateVariables";
import { buildPushResult, buildSkippedPush } from "@/lib/push/normalizePushResult";

function templatesFromIntegration(integration) {
  if (!integration?.templates?.length) return [];
  return integration.templates;
}

function findCachedTemplate(integration, templateName) {
  const name = templateName?.trim();
  if (!name) return null;
  return (
    templatesFromIntegration(integration).find(
      (t) =>
        t.name === name ||
        t.id === name ||
        t.displayName === name
    ) ?? null
  );
}

function metaLanguageCode(template, override) {
  if (override) return override;
  const lang = template?.language ?? "en";
  return typeof lang === "string" ? lang : "en";
}

function shouldUseMarketingMessagesApi(template) {
  if (process.env.WHATSAPP_USE_MARKETING_API === "true") return true;
  const category = String(template?.category ?? "").toUpperCase();
  return category === "MARKETING";
}

function resolveVariableCounts(cached, storedRow) {
  const fromCache = cached ? parseWhatsAppTemplateVariableSlots(cached) : null;
  const bodyCount =
    fromCache?.bodyCount ?? countWhatsAppNumberedVariables(storedRow?.body);
  const headerCount = fromCache?.headerCount ?? 0;
  return { bodyCount, headerCount };
}

/**
 * Build body/header parameter arrays for Meta or Interakt.
 * Uses campaign mapping when present; never sends spurious params for static templates.
 */
export function resolveWhatsAppTemplateParameters({
  cached,
  storedRow,
  mapping,
  prospect,
  campaign,
  renderedMessage,
}) {
  const { bodyCount, headerCount } = resolveVariableCounts(cached, storedRow);
  let normalizedMapping = normalizeWhatsAppVariableMapping(
    mapping ?? storedRow?.whatsappVariableMapping
  );

  if (
    (bodyCount > 0 || headerCount > 0) &&
    normalizedMapping.body.length < bodyCount &&
    cached
  ) {
    normalizedMapping = defaultWhatsAppVariableMapping(cached);
  }

  if (bodyCount > 0 || headerCount > 0) {
    if (
      normalizedMapping.body.length < bodyCount ||
      normalizedMapping.header.length < headerCount
    ) {
      return {
        error: `Template "${storedRow?.whatsappTemplateId ?? cached?.name}" requires ${bodyCount} body and ${headerCount} header variable(s). Configure mapping on the campaign.`,
      };
    }

    return buildWhatsAppTemplateParameters({
      mapping: normalizedMapping,
      prospect,
      campaign,
      bodyVariableCount: bodyCount,
      headerVariableCount: headerCount,
    });
  }

  return { bodyValues: [], headerValues: [] };
}

/**
 * Send an approved WhatsApp template to a prospect (Meta Cloud API or Interakt).
 */
export async function pushWhatsAppTemplate({
  tenantId,
  prospect,
  templateName,
  languageCode,
  bodyValues = [],
  headerValues = [],
  buttonValues = {},
  callbackData,
  useMarketingApi,
  cachedTemplate = null,
}) {
  const integration = await getWhatsAppIntegration(tenantId);
  if (!integration || integration.status !== "connected") {
    return buildSkippedPush("whatsapp_not_connected");
  }

  const phone = prospect.whatsapp?.trim();
  if (!phone) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: { error: "missing_whatsapp" },
      error: `Prospect ${prospect.name} has no WhatsApp number`,
    });
  }

  const resolvedName = templateName?.trim();
  if (!resolvedName) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: { error: "missing_template_name" },
      error: "WhatsApp template name is required",
    });
  }

  const cached = cachedTemplate ?? findCachedTemplate(integration, resolvedName);
  const lang = metaLanguageCode(cached, languageCode);
  const body = bodyValues ?? [];
  const header = headerValues ?? [];

  const { bodyCount, headerCount } = resolveVariableCounts(cached, null);

  if (body.length !== bodyCount) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: {
        error: "parameter_count_mismatch",
        expectedBody: bodyCount,
        gotBody: body.length,
      },
      error: `WhatsApp template "${resolvedName}" expects ${bodyCount} body parameter(s), got ${body.length}.`,
    });
  }

  if (header.length !== headerCount) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: {
        error: "parameter_count_mismatch",
        expectedHeader: headerCount,
        gotHeader: header.length,
      },
      error: `WhatsApp template "${resolvedName}" expects ${headerCount} header parameter(s), got ${header.length}.`,
    });
  }

  try {
    if (integration.mode === "interakt") {
      const apiKey = await getDecryptedAccessToken(tenantId);
      const { countryCode, phoneNumber } = splitPhoneNumber(phone);
      const result = await sendInteraktTemplate({
        apiKey,
        countryCode,
        phoneNumber,
        templateName: resolvedName,
        languageCode: lang,
        bodyValues: body,
        headerValues: header,
        buttonValues,
        callbackData,
      });

      return buildPushResult({
        status: "sent",
        deliveryProvider: "interakt",
        deliveryMeta: {
          templateName: resolvedName,
          languageCode: lang,
          messageId: result.id ?? null,
          wamid: result.id ?? null,
          phone,
          bodyValues: body,
          headerValues: header,
          callbackData: callbackData ?? null,
        },
        deliveryMessage: result.message ?? "WhatsApp template sent via Interakt.",
      });
    }

    if (integration.mode !== "meta") {
      return buildSkippedPush("whatsapp_mode_unsupported");
    }

    const accessToken = await getDecryptedAccessToken(tenantId);
    if (!accessToken || !integration.phoneNumberId) {
      return buildSkippedPush("whatsapp_meta_not_configured", "meta");
    }

    const sendMarketing =
      useMarketingApi === true ||
      (useMarketingApi !== false && shouldUseMarketingMessagesApi(cached));

    const result = sendMarketing
      ? await sendMarketingTemplateMessage({
          phoneNumberId: integration.phoneNumberId,
          accessToken,
          to: phone,
          templateName: resolvedName,
          languageCode: lang,
          bodyParameters: body,
          headerParameters: header,
          callbackData,
        })
      : await sendTemplateMessage({
          phoneNumberId: integration.phoneNumberId,
          accessToken,
          to: phone,
          templateName: resolvedName,
          languageCode: lang,
          bodyParameters: body,
          headerParameters: header,
          callbackData,
        });

    const messageId = result?.messages?.[0]?.id ?? null;

    return buildPushResult({
      status: "sent",
      deliveryProvider: "meta",
      deliveryMeta: {
        templateName: resolvedName,
        languageCode: lang,
        messageId,
        wamid: messageId,
        phone,
        bodyValues: body,
        headerValues: header,
        api: sendMarketing ? "marketing_messages" : "messages",
        wabaId: integration.wabaId ?? null,
        callbackData: callbackData ?? null,
      },
      deliveryMessage: "WhatsApp template sent via Meta.",
    });
  } catch (err) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: integration.mode === "interakt" ? "interakt" : "meta",
      deliveryMeta: {
        error: err.message,
        templateName: resolvedName,
        sendFailed: true,
      },
      error: err.message,
    });
  }
}

/**
 * Resolve template name from campaign template id and push.
 */
export async function pushWhatsAppTemplateForDecision({
  tenantId,
  prospect,
  campaign,
  templateId,
  languageCode,
  commLogId,
}) {
  let templateName = null;
  let storedRow = null;

  if (templateId && campaign?.id) {
    storedRow = await prisma.communicationTemplate.findFirst({
      where: {
        id: templateId,
        campaignId: campaign.id,
        channel: "whatsapp",
      },
      select: {
        whatsappTemplateId: true,
        body: true,
        whatsappVariableMapping: true,
      },
    });
    templateName = storedRow?.whatsappTemplateId?.trim() || null;
    if (!templateName) {
      return buildPushResult({
        status: "failed",
        deliveryMeta: { error: "campaign_whatsapp_template_not_found" },
        error:
          "WhatsApp template is not configured for this campaign. Select templates in campaign settings.",
      });
    }
  }

  const integration = await getWhatsAppIntegration(tenantId);
  const cached = templateName
    ? findCachedTemplate(integration, templateName)
    : null;

  const params = resolveWhatsAppTemplateParameters({
    cached,
    storedRow,
    prospect,
    campaign,
  });

  if (params.error) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: { error: "missing_variable_mapping" },
      error: params.error,
    });
  }

  const callbackData = commLogId
    ? JSON.stringify({ commLogId, campaignId: campaign?.id })
    : undefined;

  return pushWhatsAppTemplate({
    tenantId,
    prospect,
    templateName,
    languageCode,
    bodyValues: params.bodyValues,
    headerValues: params.headerValues,
    callbackData,
    cachedTemplate: cached,
  });
}

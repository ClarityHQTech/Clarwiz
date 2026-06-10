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
  renderWhatsAppTemplatePreview,
} from "@/lib/whatsappTemplateParameters";
import { resolveWhatsAppTemplateParameters } from "@/lib/whatsappTemplateParameters";
import { pushWhatsAppText } from "@/lib/push/whatsappText";
import {
  hasWhatsAppProspectReply,
  isWhatsAppSessionWindowOpen,
  resolveWhatsAppWindowExpiresAt,
} from "@/lib/whatsappSessionWindow";
import { parseWhatsAppTemplateVariableSlots } from "@/lib/whatsappTemplateVariables";
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

function parseCommLogIdFromCallback(callbackData) {
  if (!callbackData) return null;
  try {
    const parsed =
      typeof callbackData === "string" ? JSON.parse(callbackData) : callbackData;
    return parsed?.commLogId ?? null;
  } catch {
    return null;
  }
}

/** Last-resort: old template path with no template name but a planned comm log message. */
async function tryWhatsAppFreeformFromCommLog({ commLogId, tenantId, prospect }) {
  if (!commLogId) return null;

  const row = await prisma.communicationLog.findUnique({
    where: { id: commLogId },
    select: { message: true, campaignId: true, campaignContactId: true },
  });
  const messageText = row?.message?.trim();
  if (!messageText) return null;

  let commHistory = [];
  if (row?.campaignId && row?.campaignContactId) {
    commHistory = await prisma.communicationLog.findMany({
      where: {
        campaignId: row.campaignId,
        campaignContactId: row.campaignContactId,
      },
      orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
    });
  }

  const hasInbound = hasWhatsAppProspectReply(commHistory);
  const windowOpen = isWhatsAppSessionWindowOpen(
    resolveWhatsAppWindowExpiresAt(prospect, commHistory)
  );
  if (!hasInbound && !windowOpen) return null;

  return pushWhatsAppText({
    tenantId,
    prospect,
    message: messageText,
    commLogId,
  });
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
  previewBodyText = null,
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
    const commLogId = parseCommLogIdFromCallback(callbackData);
    const rescued = await tryWhatsAppFreeformFromCommLog({
      commLogId,
      tenantId,
      prospect,
    });
    if (rescued) return rescued;

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

  const renderedMessage =
    renderWhatsAppTemplatePreview({
      bodyText: cached?.body ?? previewBodyText ?? "",
      headerText: typeof cached?.header === "string" ? cached.header : "",
      bodyValues: body,
      headerValues: header,
    }) || resolvedName;

  const { bodyCount, headerCount } = cached
    ? parseWhatsAppTemplateVariableSlots(cached)
    : { bodyCount: 0, headerCount: 0 };

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
        renderedMessage,
        deliveryMeta: {
          templateName: resolvedName,
          languageCode: lang,
          messageId: result.id ?? null,
          wamid: result.id ?? null,
          phone,
          bodyValues: body,
          headerValues: header,
          renderedMessage,
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
      renderedMessage,
      deliveryMeta: {
        templateName: resolvedName,
        languageCode: lang,
        messageId,
        wamid: messageId,
        phone,
        bodyValues: body,
        headerValues: header,
        renderedMessage,
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
  renderedMessage,
  commLogId,
}) {
  let messageText = renderedMessage?.trim() || null;
  if (!messageText && commLogId) {
    const plannedRow = await prisma.communicationLog.findUnique({
      where: { id: commLogId },
      select: { message: true },
    });
    messageText = plannedRow?.message?.trim() || null;
  }

  if (!templateId?.trim() && messageText) {
    let commHistory = [];
    if (commLogId && campaign?.id) {
      const anchor = await prisma.communicationLog.findUnique({
        where: { id: commLogId },
        select: { campaignContactId: true },
      });
      if (anchor?.campaignContactId) {
        commHistory = await prisma.communicationLog.findMany({
          where: {
            campaignId: campaign.id,
            campaignContactId: anchor.campaignContactId,
          },
          orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
        });
      }
    }

    const hasInbound = hasWhatsAppProspectReply(commHistory);
    const windowOpen = isWhatsAppSessionWindowOpen(
      resolveWhatsAppWindowExpiresAt(prospect, commHistory)
    );

    if (hasInbound || windowOpen) {
      return pushWhatsAppText({
        tenantId,
        prospect,
        message: messageText,
        commLogId,
      });
    }
  }

  if (!templateId?.trim()) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: { error: "missing_template_id" },
      error:
        "WhatsApp template id is required for template sends. Use free-form text during the customer service window.",
    });
  }

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

  if (!templateName?.trim()) {
    return buildPushResult({
      status: "failed",
      deliveryMeta: { error: "missing_template_name" },
      error:
        "WhatsApp template name is required. Use free-form text during the customer service window.",
    });
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
    previewBodyText: storedRow?.body ?? null,
  });
}

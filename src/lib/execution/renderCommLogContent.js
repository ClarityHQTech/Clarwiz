import { applyTemplateVariables } from "@/lib/execution/renderMessage";
import { finalizeOutboundMessage } from "@/lib/execution/humanizeOutboundMessage";
import {
  countWhatsAppNumberedVariables,
  parseWhatsAppTemplateVariableSlots,
} from "@/lib/whatsappTemplateVariables";
import {
  renderWhatsAppTemplatePreview,
  resolveWhatsAppTemplateParameters,
} from "@/lib/whatsappTemplateParameters";

const TEMPLATE_TOKEN = /\{\{[^}]+\}\}/;

export { renderWhatsAppTemplatePreview, substituteWhatsAppNumberedVariables } from "@/lib/whatsappTemplateParameters";

export function hasUnresolvedTemplateTokens(text) {
  return Boolean(text && TEMPLATE_TOKEN.test(text));
}

export function renderWhatsAppCommLogMessage({
  storedRow,
  cached = null,
  prospect,
  campaign,
}) {
  const params = resolveWhatsAppTemplateParameters({
    cached,
    storedRow,
    prospect,
    campaign,
  });

  if (params.error) {
    return storedRow?.whatsappTemplateId?.trim() || null;
  }

  const slots = cached
    ? parseWhatsAppTemplateVariableSlots(cached)
    : {
        bodyText: storedRow?.body ?? "",
        headerText: "",
        bodyCount: countWhatsAppNumberedVariables(storedRow?.body),
        headerCount: 0,
      };

  const preview = renderWhatsAppTemplatePreview({
    bodyText: slots.bodyText || cached?.body || storedRow?.body || "",
    headerText: slots.headerText || "",
    bodyValues: params.bodyValues,
    headerValues: params.headerValues,
  });

  return preview || storedRow?.whatsappTemplateId?.trim() || null;
}

export function stripUnresolvedTemplateTokens(text, { prospect, campaign } = {}) {
  if (!text) return "";
  let out = applyTemplateVariables(String(text), { prospect, campaign });
  out = out.replace(/\{\{[^}]+\}\}/g, "");
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Resolve exact outbound copy for comm log storage / display (no {{tokens}}).
 */
export function resolveCommLogOutboundContent({
  channel,
  message,
  subject,
  templateId,
  prospect,
  campaign,
  templates = [],
  cachedWhatsAppTemplate = null,
}) {
  const template = templateId
    ? templates.find((t) => t.id === templateId)
    : null;

  if (channel === "whatsapp") {
    if (template) {
      const rendered = renderWhatsAppCommLogMessage({
        storedRow: template,
        cached: cachedWhatsAppTemplate,
        prospect,
        campaign,
      });
      if (rendered) {
        return { message: rendered, subject: null };
      }
    } else if (message?.trim()) {
      let outMessage = applyTemplateVariables(message, { prospect, campaign });
      outMessage = finalizeOutboundMessage({
        message: outMessage,
        prospect,
        campaign,
        isReplyFollowUp: false,
        latestReply: null,
      });
      outMessage = stripUnresolvedTemplateTokens(outMessage, {
        prospect,
        campaign,
      });
      return { message: outMessage, subject: null };
    }
  }

  let outMessage = message ?? "";
  let outSubject = subject ?? null;

  if (template && channel !== "whatsapp") {
    if (!outMessage.trim() || hasUnresolvedTemplateTokens(outMessage)) {
      outMessage = applyTemplateVariables(template.body, { prospect, campaign });
    }
    if (
      template.channel === "email" &&
      template.subject &&
      (!outSubject?.trim() || hasUnresolvedTemplateTokens(outSubject))
    ) {
      outSubject = applyTemplateVariables(template.subject, {
        prospect,
        campaign,
      });
    }
  }

  outMessage = finalizeOutboundMessage({
    message: outMessage,
    prospect,
    campaign,
    isReplyFollowUp: false,
    latestReply: null,
  });

  if (outSubject) {
    outSubject = finalizeOutboundMessage({
      message: outSubject,
      prospect,
      campaign,
      isReplyFollowUp: false,
      latestReply: null,
    });
  }

  outMessage = stripUnresolvedTemplateTokens(outMessage, { prospect, campaign });
  outSubject = outSubject
    ? stripUnresolvedTemplateTokens(outSubject, { prospect, campaign })
    : null;

  return { message: outMessage, subject: outSubject };
}

/** Re-render stored log copy for UI when legacy rows still contain template tokens. */
export function resolveCommLogDisplayContent(log, { prospect, campaign, templates = [] } = {}) {
  if (!log) return { message: "", subject: null };

  const needsMessage =
    log.message && hasUnresolvedTemplateTokens(log.message);
  const needsSubject =
    log.subject && hasUnresolvedTemplateTokens(log.subject);
  const whatsappNumbered =
    log.channel === "whatsapp" &&
    log.message &&
    /\{\{\d+\}\}/.test(log.message);

  if (!needsMessage && !needsSubject && !whatsappNumbered) {
    return { message: log.message ?? "", subject: log.subject ?? null };
  }

  if (
    log.channel === "whatsapp" &&
    log.deliveryMeta?.bodyValues &&
    log.message
  ) {
    const preview = renderWhatsAppTemplatePreview({
      bodyText: log.message,
      bodyValues: log.deliveryMeta.bodyValues,
      headerValues: log.deliveryMeta.headerValues ?? [],
    });
    if (preview && !hasUnresolvedTemplateTokens(preview)) {
      return { message: preview, subject: null };
    }
  }

  if (!prospect) {
    return { message: log.message ?? "", subject: log.subject ?? null };
  }

  return resolveCommLogOutboundContent({
    channel: log.channel,
    message: log.message,
    subject: log.subject,
    templateId: log.templateId,
    prospect,
    campaign,
    templates,
  });
}

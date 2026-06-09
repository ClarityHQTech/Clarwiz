import { applyTemplateVariables } from "@/lib/execution/renderMessage";
import {
  countWhatsAppNumberedVariables,
  defaultWhatsAppVariableMapping,
  getCustomMappingText,
  isCustomMappingValue,
  normalizeWhatsAppVariableMapping,
  parseWhatsAppTemplateVariableSlots,
} from "@/lib/whatsappTemplateVariables";

function resolveVariableCounts(cached, storedRow) {
  const fromCache = cached ? parseWhatsAppTemplateVariableSlots(cached) : null;
  const bodyCount =
    fromCache?.bodyCount ?? countWhatsAppNumberedVariables(storedRow?.body);
  const headerCount = fromCache?.headerCount ?? 0;
  return { bodyCount, headerCount };
}

export function resolveMappingText(text, { prospect, campaign }) {
  if (!text?.trim()) return " ";
  let resolved = applyTemplateVariables(text, { prospect, campaign });
  resolved = resolved.replace(/\{\{campaign_id\}\}/gi, campaign?.id ?? "");
  const trimmed = String(resolved ?? "").trim();
  return trimmed || " ";
}

export function resolveCampaignVariable(variableKey, { prospect, campaign }) {
  if (!variableKey?.trim()) return " ";
  if (isCustomMappingValue(variableKey)) {
    return resolveMappingText(getCustomMappingText(variableKey), {
      prospect,
      campaign,
    });
  }
  const key = variableKey.replace(/[{}]/g, "").trim();
  const token = `{{${key}}}`;
  return resolveMappingText(token, { prospect, campaign });
}

/**
 * Build Meta/Interakt parameter arrays from stored mapping + prospect context.
 */
export function buildWhatsAppTemplateParameters({
  mapping,
  prospect,
  campaign,
  bodyVariableCount = 0,
  headerVariableCount = 0,
}) {
  const normalized = normalizeWhatsAppVariableMapping(mapping);
  const bodyValues = [];
  const headerValues = [];

  for (let i = 0; i < bodyVariableCount; i++) {
    const key = normalized.body[i];
    bodyValues.push(resolveCampaignVariable(key, { prospect, campaign }));
  }

  for (let i = 0; i < headerVariableCount; i++) {
    const key = normalized.header[i];
    headerValues.push(resolveCampaignVariable(key, { prospect, campaign }));
  }

  return { bodyValues, headerValues };
}

/**
 * Build body/header parameter arrays for Meta or Interakt.
 */
export function resolveWhatsAppTemplateParameters({
  cached,
  storedRow,
  mapping,
  prospect,
  campaign,
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

/** Replace {{1}}, {{2}}, … with resolved parameter values. */
export function substituteWhatsAppNumberedVariables(text, values = []) {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, (_, num) => {
    const index = parseInt(num, 10) - 1;
    const value = values[index];
    return value != null && String(value).trim() ? String(value).trim() : "";
  });
}

export function renderWhatsAppTemplatePreview({
  bodyText = "",
  headerText = "",
  bodyValues = [],
  headerValues = [],
}) {
  const parts = [];
  if (headerText?.trim()) {
    parts.push(substituteWhatsAppNumberedVariables(headerText, headerValues));
  }
  if (bodyText?.trim()) {
    parts.push(substituteWhatsAppNumberedVariables(bodyText, bodyValues));
  }
  return parts.filter(Boolean).join("\n\n").trim();
}

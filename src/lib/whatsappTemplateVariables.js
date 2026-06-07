/** Prospect/campaign fields mappable to WhatsApp {{1}}, {{2}}, … slots. */
export const WHATSAPP_CAMPAIGN_VARIABLES = [
  { key: "first_name", label: "First name", token: "{{first_name}}" },
  { key: "company", label: "Company", token: "{{company}}" },
  { key: "job_title", label: "Job title", token: "{{job_title}}" },
  { key: "pain_point", label: "Pain point", token: "{{pain_point}}" },
  { key: "prospect_id", label: "Prospect ID", token: "{{prospect_id}}" },
];

/** Select value that opens the custom fixed-text editor. */
export const WHATSAPP_MAPPING_CUSTOM_OPTION = "__custom__";

/** Prefix for stored custom mapping values: `custom:https://…?{{prospect_id}}` */
export const WHATSAPP_CUSTOM_MAPPING_PREFIX = "custom:";

/** Tokens available inside custom fixed text. */
export const WHATSAPP_CUSTOM_TEXT_TOKENS = [
  ...WHATSAPP_CAMPAIGN_VARIABLES.map((v) => v.token),
  "{{campaign_id}}",
];

const DEFAULT_KEY_ORDER = WHATSAPP_CAMPAIGN_VARIABLES.map((v) => v.key);

export function isCustomMappingValue(value) {
  return (
    typeof value === "string" &&
    value.startsWith(WHATSAPP_CUSTOM_MAPPING_PREFIX)
  );
}

export function getCustomMappingText(value) {
  if (!isCustomMappingValue(value)) return "";
  return value.slice(WHATSAPP_CUSTOM_MAPPING_PREFIX.length);
}

export function encodeCustomMapping(text) {
  return `${WHATSAPP_CUSTOM_MAPPING_PREFIX}${text ?? ""}`;
}

export function mappingSelectValue(storedValue) {
  if (!storedValue?.trim()) return "";
  if (isCustomMappingValue(storedValue)) return WHATSAPP_MAPPING_CUSTOM_OPTION;
  return storedValue;
}

/** Count positional placeholders {{1}}, {{2}} in Meta/Interakt template text. */
export function countWhatsAppNumberedVariables(text) {
  if (!text || typeof text !== "string") return 0;
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches?.length) return 0;
  const indices = matches.map((m) => Number(m.replace(/\D/g, "")));
  return Math.max(...indices);
}

/** Parse variable slot counts from a cached provider template. */
export function parseWhatsAppTemplateVariableSlots(waTemplate) {
  const bodyText = waTemplate?.body ?? "";
  const headerText =
    typeof waTemplate?.header === "string" ? waTemplate.header : "";
  const bodyCount =
    waTemplate?.variableCount ??
    waTemplate?.bodyVariableCount ??
    countWhatsAppNumberedVariables(bodyText);
  const headerCount =
    waTemplate?.headerVariableCount ??
    countWhatsAppNumberedVariables(headerText);

  return {
    bodyCount,
    headerCount,
    bodyText,
    headerText,
    totalCount: bodyCount + headerCount,
  };
}

/** Default mapping: {{1}}→first_name, {{2}}→company, etc. */
export function defaultWhatsAppVariableMapping(waTemplate) {
  const { bodyCount, headerCount } = parseWhatsAppTemplateVariableSlots(waTemplate);
  const pick = (index) => DEFAULT_KEY_ORDER[index] ?? DEFAULT_KEY_ORDER[0];

  return {
    body: Array.from({ length: bodyCount }, (_, i) => pick(i)),
    header: Array.from({ length: headerCount }, (_, i) => pick(i)),
  };
}

export function normalizeWhatsAppVariableMapping(mapping) {
  if (!mapping || typeof mapping !== "object") {
    return { body: [], header: [] };
  }
  return {
    body: Array.isArray(mapping.body) ? mapping.body.map(String) : [],
    header: Array.isArray(mapping.header) ? mapping.header.map(String) : [],
  };
}

export {
  buildWhatsAppTemplateParameters,
  resolveCampaignVariable,
  resolveMappingText,
  resolveWhatsAppTemplateParameters,
} from "@/lib/whatsappTemplateParameters";

export function validateWhatsAppVariableMapping(
  mapping,
  { bodyCount = 0, headerCount = 0, templateName = "WhatsApp template" } = {}
) {
  const normalized = normalizeWhatsAppVariableMapping(mapping);

  for (let i = 0; i < bodyCount; i++) {
    const slot = normalized.body[i];
    if (!slot?.trim()) {
      return `${templateName}: map body variable {{${i + 1}}} to a field or custom text.`;
    }
    if (isCustomMappingValue(slot) && !getCustomMappingText(slot).trim()) {
      return `${templateName}: enter custom text for body variable {{${i + 1}}}.`;
    }
  }

  for (let i = 0; i < headerCount; i++) {
    const slot = normalized.header[i];
    if (!slot?.trim()) {
      return `${templateName}: map header variable {{${i + 1}}} to a field or custom text.`;
    }
    if (isCustomMappingValue(slot) && !getCustomMappingText(slot).trim()) {
      return `${templateName}: enter custom text for header variable {{${i + 1}}}.`;
    }
  }

  if (bodyCount > 0 && normalized.body.length < bodyCount) {
    return `${templateName}: body expects ${bodyCount} variable(s), ${normalized.body.length} mapped.`;
  }

  if (headerCount > 0 && normalized.header.length < headerCount) {
    return `${templateName}: header expects ${headerCount} variable(s), ${normalized.header.length} mapped.`;
  }

  return null;
}

/** Email / LinkedIn template tokens (not WhatsApp numbered slots). */
export const TEMPLATE_VARIABLE_LIST = [
  { token: "{{first_name}}", label: "First name", field: "firstName" },
  { token: "{{last_name}}", label: "Last name", field: "lastName" },
  { token: "{{name}}", label: "Full name", field: "name" },
  { token: "{{company}}", label: "Company", field: "company" },
  { token: "{{job_title}}", label: "Job title", field: "jobTitle" },
];

export const TEMPLATE_VARIABLE_FIELD_MAP = Object.fromEntries(
  TEMPLATE_VARIABLE_LIST.map(({ token, field }) => [
    token.replace(/\{\{|\}\}/g, "").toLowerCase(),
    field,
  ])
);

export const TEMPLATE_VARIABLES = TEMPLATE_VARIABLE_LIST.map((v) => v.token).join(
  ", "
);

/**
 * Tokens referenced in template copy (email/LinkedIn {{var}} syntax).
 */
export function extractTemplateVariableKeys(...texts) {
  const keys = new Set();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(/\{\{(\w+)\}\}/gi)) {
      keys.add(match[1].toLowerCase());
    }
  }
  return [...keys];
}

/**
 * Prospect DB fields required for a template — strict, no derived fallbacks.
 */
export function getMissingProspectVariablesForTemplate(template, prospect) {
  if (!template || template.channel === "whatsapp") return [];

  const texts = [template.body];
  if (template.channel === "email" && template.subject) {
    texts.push(template.subject);
  }

  const missing = [];
  for (const key of extractTemplateVariableKeys(...texts)) {
    if (!TEMPLATE_VARIABLE_FIELD_MAP[key]) continue;
    const field = TEMPLATE_VARIABLE_FIELD_MAP[key];
    const value = prospect?.[field];
    if (!value || !String(value).trim()) {
      missing.push(key);
    }
  }
  return missing;
}

export function canUseTemplateForProspect(template, prospect) {
  return getMissingProspectVariablesForTemplate(template, prospect).length === 0;
}

/**
 * Insert a token at the textarea/input cursor, or append if no ref.
 */
export function insertVariableIntoField(currentValue, token, inputRef) {
  const el = inputRef?.current;
  if (el && typeof el.selectionStart === "number") {
    const start = el.selectionStart;
    const end = el.selectionEnd ?? start;
    const next = currentValue.slice(0, start) + token + currentValue.slice(end);
    return { value: next, cursor: start + token.length };
  }
  const next = (currentValue ?? "") + token;
  return { value: next, cursor: next.length };
}

export function restoreInputCursor(inputRef, cursor) {
  const el = inputRef?.current;
  if (!el || cursor == null) return;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(cursor, cursor);
  });
}

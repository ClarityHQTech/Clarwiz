export const TEMPLATE_VARIABLE_LIST = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{company}}", label: "Company" },
  { token: "{{job_title}}", label: "Job title" },
  { token: "{{pain_point}}", label: "Pain point" },
];

export const TEMPLATE_VARIABLES = TEMPLATE_VARIABLE_LIST.map((v) => v.token).join(
  ", "
);

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

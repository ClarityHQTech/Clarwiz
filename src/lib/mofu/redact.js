// G-8 — Redact obvious PII before sending context/signals to LLM providers.
// Conservative: emails, phone numbers, and long digit runs. Keeps raw out of prompts.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;

export function redactText(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(EMAIL, "[email]")
    .replace(SSN, "[id]")
    .replace(PHONE, "[phone]");
}

/** Deep-redact strings in arrays/objects (returns a copy). */
export function redactDeep(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return undefined;
    seen.add(value);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v, seen);
    return out;
  }
  return value;
}

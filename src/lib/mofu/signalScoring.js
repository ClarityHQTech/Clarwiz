// US-2.1 — Deterministic signal scoring. No LLM, no I/O, fully unit-testable.
// score = recencyWeight x typeWeight x intentWeight

export const TYPE_WEIGHTS = {
  CALL_TRANSCRIPT: 1.0,
  MEETING: 0.9,
  STAGE_CHANGE: 0.8,
  EMAIL: 0.6,
  NOTE: 0.4,
};

const HALF_LIFE_DAYS = 14;
const INTENT_TERMS = [
  "pricing",
  "contract",
  "demo",
  "timeline",
  "budget",
  "decision",
  "proposal",
  "renew",
];

/** Exponential recency decay: 1.0 now -> 0.5 at 14 days. Missing date -> neutral 0.5. */
export function recencyWeight(occurredAt, now = new Date()) {
  if (!occurredAt) return 0.5;
  const days = Math.max(0, (now.getTime() - new Date(occurredAt).getTime()) / 86_400_000);
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/** Up to +50% for matched intent terms. */
export function intentWeight(hints = []) {
  const hits = hints.filter((h) => INTENT_TERMS.includes(String(h).toLowerCase())).length;
  return 1 + Math.min(0.5, hits * 0.15);
}

export function scoreSignal({ kind, occurredAt, now = new Date(), intentHints = [] }) {
  const type = TYPE_WEIGHTS[kind] ?? 0.3;
  return Number((recencyWeight(occurredAt, now) * type * intentWeight(intentHints)).toFixed(4));
}

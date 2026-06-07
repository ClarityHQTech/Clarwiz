/**
 * Deterministic best-match ranking for the Collateral Hub.
 *
 * Pure functions — no DB, no I/O — so they're trivially testable and reusable
 * by both the directory UI and any "suggest collateral for this deal" feature.
 *
 * Scoring (higher = better fit):
 *   +3  exact companyHsId match (item is tied to this exact company)
 *   +2  funnelStage exactly matches the context stage
 *   +1  item.funnelStage === 'ANY' (stage-agnostic fallback) when no exact match
 *   +1  per item tag that intersects the [industry, persona] keywords (ci)
 * Tie-break: newest createdAt wins.
 */

function ts(value) {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Score a single item against the context, returning { score, reasons }. */
function scoreItem(item, ctx) {
  const reasons = [];
  let score = 0;

  const { funnelStage, companyHsId, industry, persona } = ctx;

  if (companyHsId && item.companyHsId && String(item.companyHsId) === String(companyHsId)) {
    score += 3;
    reasons.push("Tied to this company");
  }

  const stage = item.funnelStage ?? "ANY";
  if (funnelStage && stage === funnelStage && funnelStage !== "ANY") {
    score += 2;
    reasons.push(`Matches ${funnelStage} stage`);
  } else if (stage === "ANY") {
    score += 1;
    reasons.push("Works at any stage");
  }

  const keywords = [industry, persona]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase());
  if (keywords.length && Array.isArray(item.tags)) {
    const tagsLower = item.tags.map((t) => String(t).toLowerCase());
    const hits = keywords.filter((k) => tagsLower.includes(k));
    if (hits.length) {
      score += hits.length;
      reasons.push(`Tagged ${hits.join(", ")}`);
    }
  }

  return { score, reasons };
}

/**
 * Rank items desc by fit. Returns a new array of items, each augmented with
 * `{ score, reasons:[str] }`. Stable on score via newest-createdAt tie-break.
 */
export function rankCollateral(items = [], ctx = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];

  return items
    .map((item) => ({ ...item, ...scoreItem(item, ctx) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return ts(b.createdAt) - ts(a.createdAt);
    });
}

/** Top-n best matches (default 3), already scored & sorted. */
export function topSuggestions(items = [], ctx = {}, n = 3) {
  return rankCollateral(items, ctx).slice(0, n);
}

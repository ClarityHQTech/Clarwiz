/**
 * Pure formatting helpers for the AE Cockpit UI. No React. Keeps the cockpit
 * components terse and consistent with the mockup's amount/score/time styling.
 */

/** Whole-USD amount ($240,000). Dash for non-numbers. */
export function fmtAmount(amount) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }
}

/** Compact amount ($240K) for tight cards. */
export function fmtAmountShort(amount) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

/** Human staleness: "just now" / "30m ago" / "3h ago" / "3d ago". */
export function fmtStaleness(ts, now = new Date()) {
  if (!ts) return "—";
  const then = new Date(ts);
  if (Number.isNaN(then.getTime())) return "—";
  const secs = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Short date (Jun 28, 2026). */
export function fmtDate(d) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Clamp a score-ish value to 0-100 number, or null. */
export function asScore(v) {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.-]/g, "")) : v;
  if (n == null || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Stroke color var for a score ring by band. */
export function scoreVar(score) {
  if (score == null) return "var(--muted)";
  if (score >= 70) return "var(--ok)";
  if (score >= 40) return "var(--warn)";
  return "var(--danger)";
}

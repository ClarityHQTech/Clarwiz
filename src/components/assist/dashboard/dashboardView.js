/**
 * Pure view-model helpers for the AE dashboard. No React, no Chakra — just
 * formatting + shaping the hydrated graph into render-ready rows. Unit-tested.
 */

const STAGE_COLORS = {
  DEAL_EARLY: "blue",
  DEAL_LATE: "purple",
};

/** Format a numeric amount as whole USD ($1,500). Dash for non-numbers. */
export function formatAmount(amount) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n == null || Number.isNaN(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Chakra colorScheme for a deal stage band. */
export function stageColor(band) {
  return STAGE_COLORS[band] ?? "gray";
}

/** Newest Account.syncedAt across the hydrated accounts (or null). */
export function latestSyncedAt(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  let latest = null;
  for (const a of accounts) {
    const t = a?.syncedAt ? new Date(a.syncedAt) : null;
    if (t && (!latest || t > latest)) latest = t;
  }
  return latest;
}

/** Human staleness chip: "just now" / "30m ago" / "3h ago" / "3d ago". */
export function formatStaleness(syncedAt, now = new Date()) {
  if (!syncedAt) return "never synced";
  const then = new Date(syncedAt);
  const secs = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Shape getDashboardData() output into the dashboard view model. */
export function buildDashboardView(data = {}) {
  const deals = Array.isArray(data.deals) ? data.deals : [];
  const leads = Array.isArray(data.leads) ? data.leads : [];
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];

  const counts = { deals: deals.length, leads: leads.length, accounts: accounts.length };
  const isEmpty = counts.deals === 0 && counts.leads === 0 && counts.accounts === 0;

  return {
    deals,
    leads,
    accounts,
    counts,
    isEmpty,
    latestSyncedAt: latestSyncedAt(accounts),
  };
}

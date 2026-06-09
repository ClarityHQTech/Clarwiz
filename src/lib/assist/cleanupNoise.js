/**
 * Pure selector for "noise" accounts that are safe to remove during a one-time
 * cleanup of already-synced internal / email-noise company records.
 *
 * Background: HubSpot auto-creates a contact for every email recipient, and the
 * MOFU domain-enrichment path turns lone contacts into a synthetic Account
 * (`hubspotCompanyId` = `domain:<domain>`). Before internal-domain suppression
 * existed, this produced two kinds of junk Accounts:
 *   1. Accounts for the tenant's OWN domains (now configurable as internal).
 *   2. Domain-synthetic Accounts whose only contact has since been removed —
 *      orphans with nothing linked.
 *
 * An account is "noise" iff it has 0 deals AND either:
 *   - its `company.domain` is in `internalDomains`, OR
 *   - it is a domain-synthetic account (`hubspotCompanyId` starts with
 *     `domain:`) whose company has 0 linked contacts in this tenant.
 *
 * SAFETY: an account with >= 1 deal is NEVER selected, regardless of the above.
 *
 * @param {Array<{
 *   id: string,
 *   hubspotCompanyId?: string | null,
 *   dealCount?: number,
 *   contactCount?: number,
 *   company?: { domain?: string | null } | null,
 * }>} accounts
 * @param {string[]} internalDomains
 * @returns {string[]} ids of the accounts to remove
 */
export function selectNoiseAccounts(accounts, internalDomains = []) {
  const internal = new Set(
    (internalDomains || [])
      .filter((d) => typeof d === "string")
      .map((d) => d.toLowerCase())
  );

  const ids = [];
  for (const a of accounts || []) {
    const dealCount = Number(a?.dealCount) || 0;
    if (dealCount >= 1) continue; // SAFETY: never touch an account with deals.

    const domain = (a?.company?.domain || "").toLowerCase();
    const isInternal = domain && internal.has(domain);

    const isSynthetic =
      typeof a?.hubspotCompanyId === "string" && a.hubspotCompanyId.startsWith("domain:");
    const isOrphanSynthetic = isSynthetic && (Number(a?.contactCount) || 0) === 0;

    if (isInternal || isOrphanSynthetic) ids.push(a.id);
  }
  return ids;
}

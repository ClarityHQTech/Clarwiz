/**
 * Domain-based contact ↔ Company/Account enrichment for MOFU sync.
 *
 * Links a contact (especially a standalone MQL lead with no HubSpot company
 * association) to a shared global Company via its email domain, and ensures the
 * tenant has an Account for that Company. Two contacts from the same domain —
 * even brought in by different AEs / tenants — resolve to the same global
 * Company (deduped by domain); each tenant still gets its own Account, so
 * company-level insights attach at the account level.
 *
 * NOTE: this is purely domain-based (no extra HubSpot calls). Reading the
 * HubSpot contact→company association could improve accuracy later; the domain
 * path is implemented here as the always-available fallback.
 */

/**
 * Free-mail providers — personal addresses must NOT collapse into one "company".
 * Exported so callers/tests can reason about the exclusion set.
 */
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "zoho.com",
  "yandex.com",
]);

// Multi-label public suffixes where the registrable domain keeps an extra label
// (e.g. acme.co.uk, not co.uk). Best-effort list covering the common cases.
const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "co.in",
  "co.jp",
  "com.au",
  "com.br",
  "co.nz",
  "co.za",
  "com.sg",
  "com.mx",
]);

/**
 * Extract the registrable domain from an email address.
 * Lowercased, best-effort subdomain stripping. Returns null for free-mail
 * providers (so personal addresses don't all collapse into one "company") and
 * for empty / malformed input.
 */
export function domainFromEmail(email) {
  if (!email || typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const host = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host || !host.includes(".")) return null;

  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return null;

  const lastTwo = labels.slice(-2).join(".");
  const registrable = MULTI_LABEL_SUFFIXES.has(lastTwo)
    ? labels.slice(-3).join(".")
    : lastTwo;

  if (FREE_MAIL_DOMAINS.has(registrable)) return null;
  return registrable;
}

/**
 * Resolve (find-or-create) a global Company for a contact, and ensure the
 * tenant has an Account for it. Idempotent — never duplicates.
 *
 * Matching order: by domain → by name → create.
 *
 * @returns {{ companyId: string, accountId: string } | null}
 *   null when there is no resolvable business domain (free-mail / malformed).
 */
export async function resolveCompanyForContact(
  prisma,
  tenantId,
  { email, companyName, domain, internalDomains = [] } = {}
) {
  const resolvedDomain = domain ? domainFromEmail(`x@${domain}`) || null : domainFromEmail(email);
  // Need a business domain to anchor on; without one we can't safely dedup.
  if (!resolvedDomain) return null;
  // Our own company's domain → not a prospect; never create a company for it.
  if (internalDomains.includes(resolvedDomain)) return null;

  // 1) Company — global, deduped by domain first, then by name.
  let company = await prisma.company.findFirst({ where: { domain: resolvedDomain } });
  if (!company && companyName) {
    company = await prisma.company.findFirst({ where: { name: companyName } });
  }
  if (!company) {
    company = await prisma.company.create({
      data: { name: companyName || resolvedDomain, domain: resolvedDomain },
    });
  }

  // 2) Account — per-tenant view of the Company. hubspotCompanyId is required
  // and unique per (tenant, id); domain-resolved accounts have no HubSpot
  // company, so synthesize a stable, collision-safe id. A later deal sync that
  // brings the real HubSpot company id creates a distinct Account keyed on it;
  // both point at the same global Company, so insights still aggregate by company.
  let account = await prisma.account.findFirst({ where: { tenantId, companyId: company.id } });
  if (!account) {
    account = await prisma.account.create({
      data: {
        tenantId,
        companyId: company.id,
        hubspotCompanyId: `domain:${resolvedDomain}`,
      },
    });
  }

  return { companyId: company.id, accountId: account.id };
}

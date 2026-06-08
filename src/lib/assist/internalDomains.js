import { domainFromEmail } from "@/lib/assist/companyResolve";

/**
 * Normalize a raw, user-typed domain to its bare host form.
 *
 * Lowercases, trims, strips a leading `@` (so `@clarityhq.ai` works), a
 * `scheme://` prefix and any path (so a pasted URL works), and a leading
 * `www.`. Unlike `domainFromEmail`, this does NOT free-mail-filter and does NOT
 * collapse subdomains — configured domains are taken verbatim because the user
 * opted in explicitly. Returns null for empty / non-domain input.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeDomain(raw) {
  if (typeof raw !== "string") return null;
  let host = raw.trim().toLowerCase();
  if (!host) return null;
  host = host.replace(/^@/, "");
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // strip scheme://
  host = host.split("/")[0]; // drop any path
  host = host.split("@").pop(); // tolerate a pasted email
  host = host.replace(/^www\./, "");
  host = host.replace(/\.$/, "").trim();
  if (!host || !host.includes(".")) return null;
  return host;
}

/**
 * The tenant's own ("internal") business email domains.
 *
 * HubSpot auto-creates a contact for every recipient on a logged email, so a
 * teammate cc'd on a thread would otherwise show up as a "lead" and have their
 * domain turned into a prospect company. We use these domains to suppress
 * colleagues from the leads list and from company creation.
 *
 * The result MERGES two sources:
 *  1. Domains derived from team members' login emails. Free-mail domains are
 *     excluded here (a member who logs in with gmail must NOT make gmail an
 *     "internal" domain) — `domainFromEmail` returns null for those.
 *  2. Domains the AE explicitly configured at
 *     `Tenant.company_details.internalDomains` (an array of strings). These are
 *     taken verbatim (normalized only) — NOT free-mail-filtered — because the
 *     user opted in on purpose.
 *
 * Deduped. Return shape is unchanged (`string[]`).
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<string[]>}
 */
export async function getTenantInternalDomains(prisma, tenantId) {
  const [members, tenant] = await Promise.all([
    prisma.tenantMembership.findMany({
      where: { tenantId },
      select: { user: { select: { email: true } } },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { company_details: true },
    }),
  ]);

  const domains = new Set();

  for (const m of members) {
    const d = domainFromEmail(m.user?.email);
    if (d) domains.add(d);
  }

  for (const raw of getConfiguredInternalDomains(tenant)) {
    domains.add(raw);
  }

  return [...domains];
}

/**
 * The explicitly-configured internal domains for a tenant, normalized + deduped.
 * Pure over an already-loaded tenant row; safe against malformed JSON.
 *
 * @param {{ company_details?: unknown } | null | undefined} tenant
 * @returns {string[]}
 */
export function getConfiguredInternalDomains(tenant) {
  const cd =
    tenant?.company_details && typeof tenant.company_details === "object"
      ? tenant.company_details
      : {};
  const list = Array.isArray(cd.internalDomains) ? cd.internalDomains : [];
  const out = new Set();
  for (const raw of list) {
    const d = normalizeDomain(raw);
    if (d) out.add(d);
  }
  return [...out];
}

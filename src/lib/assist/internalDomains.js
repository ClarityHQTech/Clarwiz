import { domainFromEmail } from "@/lib/assist/companyResolve";

/**
 * The tenant's own ("internal") business email domains, derived from its team
 * members' login emails.
 *
 * HubSpot auto-creates a contact for every recipient on a logged email, so a
 * teammate cc'd on a thread would otherwise show up as a "lead" and have their
 * domain turned into a prospect company. We use these domains to suppress
 * colleagues from the leads list and from company creation.
 *
 * Free-mail domains are excluded (a member who logs in with gmail must NOT make
 * gmail an "internal" domain) — domainFromEmail returns null for those.
 */
export async function getTenantInternalDomains(prisma, tenantId) {
  const members = await prisma.tenantMembership.findMany({
    where: { tenantId },
    select: { user: { select: { email: true } } },
  });
  const domains = new Set();
  for (const m of members) {
    const d = domainFromEmail(m.user?.email);
    if (d) domains.add(d);
  }
  return [...domains];
}

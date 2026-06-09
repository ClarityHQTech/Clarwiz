/**
 * Read layer / view-model contract for the MOFU UI. UI pages and API routes read
 * the hydrated graph + the latest stored intelligence through these functions.
 * The intelligence core (F2) WRITES DealInsight/CompanyInsight/Nba/Signal; this
 * module only READS them, so the UI renders whatever has been computed (or shows
 * an empty/compute state when an insight is null).
 *
 * Every function is tenant-scoped. SIGNATURES ARE A CONTRACT — keep stable.
 */

import { getTenantInternalDomains } from "@/lib/assist/internalDomains";

const MQL_STAGES = ["lead", "marketingqualifiedlead", "salesqualifiedlead", "subscriber", "opportunity"];

/** Dashboard: open leads (MQL contacts with no open deal), open deals, accounts. */
export async function getDashboardData(prisma, tenantId, { ownerId = null } = {}) {
  const dealWhere = { tenantId, status: "OPEN", ...(ownerId ? { ownerId } : {}) };

  // Exclude the tenant's own teammates (HubSpot auto-creates contacts for email
  // recipients) from the leads column. NOT(email ends with any internal domain)
  // keeps null-email contacts.
  const internalDomains = await getTenantInternalDomains(prisma, tenantId);
  const notInternal = internalDomains.length
    ? { businessUser: { NOT: { OR: internalDomains.map((d) => ({ email: { endsWith: `@${d}` } })) } } }
    : {};

  // "My book" accounts = companies where I own a deal OR own a contact. Without
  // this, every synced company (incl. domain-enriched + email-noise ones) shows
  // under My book even though they aren't part of this AE's book of business.
  const accountWhere = {
    tenantId,
    ...(ownerId
      ? {
          OR: [
            { deals: { some: { ownerId } } },
            { company: { businessUsers: { some: { contacts: { some: { tenantId, ownerId } } } } } },
          ],
        }
      : {}),
  };

  const [deals, leadContacts, accounts] = await Promise.all([
    prisma.deal.findMany({
      where: dealWhere,
      orderBy: { lastActivityAt: "desc" },
      include: { account: { include: { company: true } } },
    }),
    prisma.contact.findMany({
      where: {
        tenantId,
        lifecycleStage: { in: MQL_STAGES },
        hubspotContactId: { not: null },
        dealContacts: { none: { deal: { status: "OPEN" } } },
        // "My book": leads without a populated ownerId (e.g. synced before the
        // owners scope was granted) simply won't appear — that's intended.
        ...(ownerId ? { ownerId } : {}),
        ...notInternal,
      },
      include: { businessUser: { include: { company: true } } },
      take: 100,
    }),
    prisma.account.findMany({
      where: accountWhere,
      include: {
        company: true,
        _count: { select: { deals: true } },
      },
      orderBy: { syncedAt: "desc" },
      take: 100,
    }),
  ]);

  return { deals, leads: leadContacts, accounts };
}

/** Latest stored insight of a kind for an anchor (deal/account). */
export async function getLatestDealInsight(prisma, dealId) {
  return prisma.dealInsight.findFirst({ where: { dealId }, orderBy: { computedAt: "desc" } });
}

export async function getLatestCompanyInsight(prisma, accountId) {
  return prisma.companyInsight.findFirst({ where: { accountId }, orderBy: { computedAt: "desc" } });
}

/** Deal Workroom view model. */
export async function getDealView(prisma, tenantId, dealId) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    include: {
      account: { include: { company: true } },
      dealContacts: { include: { contact: { include: { businessUser: true } } } },
    },
  });
  if (!deal) return null;

  const [insight, nbas, signals] = await Promise.all([
    getLatestDealInsight(prisma, dealId),
    prisma.nbaRecommendation.findMany({
      where: { tenantId, dealId },
      orderBy: [{ status: "asc" }, { score: "desc" }],
    }),
    prisma.signal.findMany({ where: { tenantId, dealId }, orderBy: { score: "desc" } }),
  ]);

  return {
    deal,
    account: deal.account,
    company: deal.account?.company ?? null,
    contacts: deal.dealContacts.map((dc) => dc.contact),
    insight,
    nbas,
    signals,
  };
}

/** Company Workroom / drawer view model. */
export async function getCompanyView(prisma, tenantId, accountId) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId },
    include: { company: true },
  });
  if (!account) return null;

  const [insight, signals, deals] = await Promise.all([
    getLatestCompanyInsight(prisma, accountId),
    prisma.signal.findMany({ where: { tenantId, accountId }, orderBy: { score: "desc" } }),
    prisma.deal.findMany({ where: { tenantId, accountId }, orderBy: { lastActivityAt: "desc" } }),
  ]);

  // Contacts linked to this account's deals (best-effort stakeholder view).
  const contacts = await prisma.contact.findMany({
    where: { tenantId, dealContacts: { some: { deal: { accountId } } } },
    include: { businessUser: true },
  });

  return { account, company: account.company, insight, signals, deals, contacts };
}

/** Lead Workroom view model (no deal yet). */
export async function getLeadView(prisma, tenantId, contactId) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
    include: { businessUser: { include: { company: true } } },
  });
  if (!contact) return null;

  // Resolve the lead's account (if the company is known to this tenant).
  const companyId = contact.businessUser?.companyId ?? null;
  const account = companyId
    ? await prisma.account.findFirst({ where: { tenantId, companyId }, include: { company: true } })
    : null;

  // Signals are anchored to a deal/account (never a bare contact), so a lead's
  // signals come from its resolved account; NBAs can be contact-anchored.
  const [insight, signals, nbas] = await Promise.all([
    account ? getLatestCompanyInsight(prisma, account.id) : null,
    account
      ? prisma.signal.findMany({ where: { tenantId, accountId: account.id }, orderBy: { score: "desc" } })
      : Promise.resolve([]),
    prisma.nbaRecommendation.findMany({ where: { tenantId, contactId }, orderBy: { score: "desc" } }),
  ]);

  return { contact, businessUser: contact.businessUser, account, company: account?.company ?? null, insight, signals, nbas };
}

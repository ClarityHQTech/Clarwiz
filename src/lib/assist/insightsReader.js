/**
 * Read layer / view-model contract for the MOFU UI. UI pages and API routes read
 * the hydrated graph + the latest stored intelligence through these functions.
 * The intelligence core (F2) WRITES DealInsight/CompanyInsight/Nba/Signal; this
 * module only READS them, so the UI renders whatever has been computed (or shows
 * an empty/compute state when an insight is null).
 *
 * Every function is tenant-scoped. SIGNATURES ARE A CONTRACT — keep stable.
 */

import {
  loadCampaignContextForDeal,
  loadCampaignContextForAccount,
  loadCampaignContextForContact,
  enrichContactsWithCampaignContext,
} from "@/lib/assist/campaignContactContext";
import { getTenantInternalDomains } from "@/lib/assist/internalDomains";
import { buildTofuProspectView } from "@/lib/assist/tofuProspectView";

const MQL_STAGES = ["lead", "marketingqualifiedlead", "salesqualifiedlead", "subscriber", "opportunity"];

/** Working deals list for the AE Assist home page (open deals only). */
export async function getWorkingDealsPageData(prisma, tenantId, { ownerId = null } = {}) {
  const dealWhere = { tenantId, status: "OPEN", ...(ownerId ? { ownerId } : {}) };

  const deals = await prisma.deal.findMany({
    where: dealWhere,
    orderBy: { lastActivityAt: "desc" },
    include: {
      account: { include: { company: true } },
      _count: {
        select: {
          dealContacts: true,
          nbas: { where: { status: "EXECUTED" } },
        },
      },
    },
  });

  return { deals };
}

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
      campaignContact: {
        include: {
          campaign: { select: { id: true, name: true } },
          contact: { select: { id: true, persona: true } },
        },
      },
      dealContacts: {
        include: {
          contact: { include: { businessUser: true } },
          campaignContact: {
            include: { campaign: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!deal) return null;

  const [{ campaignContexts }, insight, nbas, signals, gtmTasks] = await Promise.all([
    loadCampaignContextForDeal(prisma, tenantId, dealId),
    getLatestDealInsight(prisma, dealId),
    prisma.nbaRecommendation.findMany({
      where: { tenantId, dealId },
      orderBy: [{ status: "asc" }, { score: "desc" }],
    }),
    prisma.signal.findMany({ where: { tenantId, dealId }, orderBy: { score: "desc" } }),
    prisma.dealGtmTask.findMany({
      where: { tenantId, dealId },
      orderBy: [{ pathIndex: "asc" }, { stepIndex: "asc" }],
    }),
  ]);

  const contacts = enrichContactsWithCampaignContext(
    deal.dealContacts.map((dc) => dc.contact),
    campaignContexts
  );

  return {
    deal,
    account: deal.account,
    company: deal.account?.company ?? null,
    contacts,
    dealContacts: deal.dealContacts,
    campaignContexts,
    insight,
    nbas,
    signals,
    gtmTasks,
  };
}

/** Company Workroom / drawer view model. */
export async function getCompanyView(prisma, tenantId, accountId) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId },
    include: { company: true },
  });
  if (!account) return null;

  const [{ campaignContexts }, insight, signals, deals] = await Promise.all([
    loadCampaignContextForAccount(prisma, tenantId, accountId),
    getLatestCompanyInsight(prisma, accountId),
    prisma.signal.findMany({ where: { tenantId, accountId }, orderBy: { score: "desc" } }),
    prisma.deal.findMany({ where: { tenantId, accountId }, orderBy: { lastActivityAt: "desc" } }),
  ]);

  // Contacts linked to this account's deals (best-effort stakeholder view).
  const contacts = await prisma.contact.findMany({
    where: { tenantId, dealContacts: { some: { deal: { accountId } } } },
    include: { businessUser: true },
  });

  return {
    account,
    company: account.company,
    insight,
    signals,
    deals,
    contacts: enrichContactsWithCampaignContext(contacts, campaignContexts),
    campaignContexts,
  };
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

/** Contact drawer view model — reuses lead enrichment; optional dealId adds stakeholder role. */
export async function getContactView(prisma, tenantId, contactId, { dealId = null } = {}) {
  const base = await getLeadView(prisma, tenantId, contactId);
  if (!base) return null;

  let dealContact = null;
  const seedIds = [];

  if (dealId) {
    dealContact = await prisma.dealContact.findFirst({
      where: { dealId, contactId },
      include: {
        campaignContact: {
          include: { campaign: { select: { id: true, name: true } } },
        },
      },
    });
    if (dealContact?.campaignContactId) seedIds.push(dealContact.campaignContactId);
  }

  const { campaignContexts } = await loadCampaignContextForContact(prisma, tenantId, contactId, {
    seedIds,
  });

  const tofuProspectViews = (
    await Promise.all(
      campaignContexts.map((ctx) => buildTofuProspectView(prisma, tenantId, ctx.id))
    )
  ).filter(Boolean);

  const primaryTofu =
    tofuProspectViews.find((v) => v.campaignContactId === dealContact?.campaignContactId) ??
    tofuProspectViews[0] ??
    null;

  const primaryContext =
    campaignContexts.find((ctx) => ctx.id === dealContact?.campaignContactId) ??
    campaignContexts[0] ??
    null;

  return {
    ...base,
    dealContact,
    campaignContexts,
    campaignContext: primaryContext,
    tofuProspectViews,
    tofuProspectView: primaryTofu,
    contact: primaryContext
      ? enrichContactsWithCampaignContext([base.contact], [primaryContext])[0]
      : base.contact,
  };
}

/**
 * H2 — hydrate the shared CRM graph (Company/Account · BusinessUser/Contact ·
 * Deal/DealContact) from HubSpot. Writes ONLY shared-kernel + MOFU tables, never
 * TOFU-outreach tables — so a MOFU-only tenant gets a real normalized CRM.
 *
 * Global identity (Company, BusinessUser) is deduped across tenants; tenant-scoped
 * bridges (Account, Contact, Deal) carry the per-portal HubSpot ids.
 */
import {
  buildStageMap,
  mapHsDeal,
  mapHsContact,
  mapHsCompany,
  dedupeAssociations,
} from "@/lib/assist/hubspotMap";
import {
  getDealPipelines,
  searchOpenDeals,
  searchMqlContacts,
  getDealAssociations,
  getContactsByIds,
  getCompaniesByIds,
} from "@/lib/assist/hubspot";
import { resolveCompanyForContact } from "@/lib/assist/companyResolve";
import { getTenantInternalDomains } from "@/lib/assist/internalDomains";
import { resolveCampaignContactId } from "@/lib/crm/campaignContactBridge";

/** Resolve (find-or-create) the global Company; deduped by domain when present, else by name. */
async function resolveCompanyId(prisma, m) {
  if (m.domain) {
    const company = await prisma.company.upsert({
      where: { domain: m.domain },
      create: { name: m.name, domain: m.domain, industry: m.industry },
      update: {
        name: m.name,
        industry: m.industry ?? undefined,
      },
    });
    return company.id;
  }

  const existing = await prisma.company.findFirst({ where: { name: m.name } });
  if (existing) {
    const company = await prisma.company.update({
      where: { id: existing.id },
      data: { industry: m.industry ?? undefined },
    });
    return company.id;
  }

  const company = await prisma.company.create({
    data: { name: m.name, industry: m.industry },
  });
  return company.id;
}

/** Upsert the tenant-scoped Account (+ its global Company). Returns the Account row. */
export async function upsertAccount(prisma, tenantId, hsCompany, { campaignContactId = null } = {}) {
  const m = mapHsCompany(hsCompany);
  const companyId = await resolveCompanyId(prisma, m);
  const resolvedCcId =
    campaignContactId ??
    (await resolveCampaignContactId(prisma, tenantId, { payload: m.payload }));
  const data = {
    companyId,
    ownerId: m.ownerId,
    lifecycleStage: m.lifecycleStage,
    payload: m.payload,
    campaignContactId: resolvedCcId,
    syncedAt: new Date(),
  };
  return prisma.account.upsert({
    where: { tenantId_hubspotCompanyId: { tenantId, hubspotCompanyId: m.hubspotCompanyId } },
    create: { tenantId, hubspotCompanyId: m.hubspotCompanyId, ...data },
    update: data,
  });
}

/** Resolve (find-or-create) the global BusinessUser, deduped by lowercased email. Returns the row. */
async function resolveBusinessUser(prisma, m) {
  if (m.email) {
    const existing = await prisma.businessUser.findFirst({ where: { email: m.email } });
    if (existing) {
      return existing;
    }
  }
  return prisma.businessUser.create({
    data: {
      name: m.name,
      firstName: m.firstName,
      lastName: m.lastName,
      jobTitle: m.jobTitle,
      email: m.email,
      phone: m.phone,
    },
  });
}

/**
 * Link a BusinessUser to a shared Company/Account by email domain (idempotent).
 * Only runs when the BU has no companyId yet — deal sync's company handling takes
 * precedence and is reused (resolve dedups by domain, never double-creating).
 * Guarded: a resolve failure must never break contact sync.
 */
async function linkBusinessUserCompanyByDomain(prisma, tenantId, businessUser, hsContact, internalDomains = []) {
  if (!businessUser || businessUser.companyId || !businessUser.email) return;
  try {
    // HubSpot contact "company" text prop, when present, names the company.
    // (A HubSpot contact→company association read could improve accuracy later.)
    const companyName = hsContact?.properties?.company || null;
    const resolved = await resolveCompanyForContact(prisma, tenantId, {
      email: businessUser.email,
      companyName,
      internalDomains,
    });
    if (!resolved) return;
    await prisma.businessUser.update({
      where: { id: businessUser.id },
      data: { companyId: resolved.companyId },
    });
  } catch {
    // Best-effort enrichment — never let it break the contact sync.
  }
}

/** Upsert the tenant-scoped Contact (+ its global BusinessUser). Returns the Contact row. */
export async function upsertContact(prisma, tenantId, hsContact, { internalDomains = [] } = {}) {
  const m = mapHsContact(hsContact);
  const businessUser = await resolveBusinessUser(prisma, m);
  // Enrich: link a company-less BusinessUser to a shared Company/Account via its
  // email domain, so standalone MQL leads resolve to an account (and its insights).
  await linkBusinessUserCompanyByDomain(prisma, tenantId, businessUser, hsContact, internalDomains);
  // ownerId (hubspot_owner_id) powers the dashboard's "My book" lead filter.
  // NOTE: existing Contact rows stay null until the tenant re-syncs after
  // (re)connecting with the crm.objects.owners.read scope — no backfill needed.
  return prisma.contact.upsert({
    where: { tenantId_businessUserId: { tenantId, businessUserId: businessUser.id } },
    create: { tenantId, businessUserId: businessUser.id, hubspotContactId: m.hubspotContactId, lifecycleStage: m.lifecycleStage, ownerId: m.ownerId },
    update: { hubspotContactId: m.hubspotContactId, lifecycleStage: m.lifecycleStage, ownerId: m.ownerId },
  });
}

/** Upsert the tenant-scoped Deal. Returns the Deal row. */
export async function upsertDeal(prisma, tenantId, hsDeal, stageMap, accountId, { campaignContactId = null } = {}) {
  const m = mapHsDeal(hsDeal, stageMap);
  const resolvedCcId =
    campaignContactId ??
    (await resolveCampaignContactId(prisma, tenantId, {
      payload: m.payload,
      hubspotDealId: m.hubspotDealId,
    }));
  const data = {
    accountId,
    name: m.name,
    stageLabel: m.stageLabel,
    stageBand: m.stageBand,
    amount: m.amount,
    status: m.status,
    ownerId: m.ownerId,
    lastActivityAt: m.lastActivityAt,
    payload: m.payload,
    campaignContactId: resolvedCcId,
    syncedAt: new Date(),
  };
  return prisma.deal.upsert({
    where: { tenantId_hubspotDealId: { tenantId, hubspotDealId: m.hubspotDealId } },
    create: { tenantId, hubspotDealId: m.hubspotDealId, ...data },
    update: data,
  });
}

async function linkDealContacts(prisma, dealId, contactLinks) {
  for (const { contactId, campaignContactId } of contactLinks) {
    await prisma.dealContact.upsert({
      where: { dealId_contactId: { dealId, contactId } },
      create: { dealId, contactId, campaignContactId: campaignContactId ?? null },
      update: { campaignContactId: campaignContactId ?? undefined },
    });
  }
}

/**
 * Full sync: open deals (+ associated companies/contacts) and MQL leads → graph.
 * Returns { ok, counts } or { ok:false, error } on a hard auth failure.
 */
export async function syncCrmGraph(prisma, tenantId, token, { fetchImpl = fetch } = {}) {
  const stageMap = buildStageMap(await getDealPipelines(token, { fetchImpl }));
  const counts = { accounts: 0, contacts: 0, deals: 0, dealContacts: 0, leads: 0 };
  // The tenant's own domains — colleagues HubSpot auto-created from email cc's
  // must not become prospect companies.
  const internalDomains = await getTenantInternalDomains(prisma, tenantId);

  const dealsRes = await searchOpenDeals(token, { fetchImpl });
  if (!dealsRes.ok && dealsRes.status === 401) {
    return { ok: false, error: "hubspot_auth", counts };
  }

  for (const hsDeal of dealsRes.results) {
    const assoc = dedupeAssociations(await getDealAssociations(token, hsDeal.id, { fetchImpl }));

    const dealCampaignContactId = await resolveCampaignContactId(prisma, tenantId, {
      payload: hsDeal.properties ?? {},
      hubspotDealId: hsDeal.id,
    });

    let accountId = null;
    let accountCampaignContactId = dealCampaignContactId;
    if (assoc.companies.length) {
      const companies = await getCompaniesByIds(token, assoc.companies, { fetchImpl });
      for (const hsCo of companies) {
        const account = await upsertAccount(prisma, tenantId, hsCo, {
          campaignContactId: accountCampaignContactId,
        });
        counts.accounts++;
        if (!accountId) accountId = account.id; // first associated company is primary
      }
    }

    const deal = await upsertDeal(prisma, tenantId, hsDeal, stageMap, accountId, {
      campaignContactId: dealCampaignContactId,
    });
    counts.deals++;

    if (assoc.contacts.length) {
      const contacts = await getContactsByIds(token, assoc.contacts, { fetchImpl });
      const contactLinks = [];
      for (const hsC of contacts) {
        const contact = await upsertContact(prisma, tenantId, hsC, { internalDomains });
        const contactCcId =
          dealCampaignContactId ??
          (await resolveCampaignContactId(prisma, tenantId, { payload: hsC.properties ?? {} }));
        contactLinks.push({ contactId: contact.id, campaignContactId: contactCcId });
        counts.contacts++;
      }
      await linkDealContacts(prisma, deal.id, contactLinks);
      counts.dealContacts += contactLinks.length;
    }
  }

  const mql = await searchMqlContacts(token, { fetchImpl });
  for (const hsC of mql.results) {
    await upsertContact(prisma, tenantId, hsC, { internalDomains });
    counts.leads++;
  }

  return { ok: true, counts };
}

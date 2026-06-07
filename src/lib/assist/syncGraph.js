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

/** Resolve (find-or-create) the global Company by unique name; refresh domain/industry. */
async function resolveCompanyId(prisma, m) {
  const company = await prisma.company.upsert({
    where: { name: m.name },
    create: { name: m.name, domain: m.domain, industry: m.industry },
    update: {
      domain: m.domain ?? undefined,
      industry: m.industry ?? undefined,
    },
  });
  return company.id;
}

/** Upsert the tenant-scoped Account (+ its global Company). Returns the Account row. */
export async function upsertAccount(prisma, tenantId, hsCompany) {
  const m = mapHsCompany(hsCompany);
  const companyId = await resolveCompanyId(prisma, m);
  const data = {
    companyId,
    ownerId: m.ownerId,
    lifecycleStage: m.lifecycleStage,
    payload: m.payload,
    syncedAt: new Date(),
  };
  return prisma.account.upsert({
    where: { tenantId_hubspotCompanyId: { tenantId, hubspotCompanyId: m.hubspotCompanyId } },
    create: { tenantId, hubspotCompanyId: m.hubspotCompanyId, ...data },
    update: data,
  });
}

/** Resolve (find-or-create) the global BusinessUser, deduped by lowercased email. */
async function resolveBusinessUserId(prisma, m) {
  if (m.email) {
    const existing = await prisma.businessUser.findFirst({ where: { email: m.email } });
    if (existing) {
      return existing.id;
    }
  }
  const bu = await prisma.businessUser.create({
    data: {
      name: m.name,
      firstName: m.firstName,
      lastName: m.lastName,
      jobTitle: m.jobTitle,
      email: m.email,
      phone: m.phone,
    },
  });
  return bu.id;
}

/** Upsert the tenant-scoped Contact (+ its global BusinessUser). Returns the Contact row. */
export async function upsertContact(prisma, tenantId, hsContact) {
  const m = mapHsContact(hsContact);
  const businessUserId = await resolveBusinessUserId(prisma, m);
  return prisma.contact.upsert({
    where: { tenantId_businessUserId: { tenantId, businessUserId } },
    create: { tenantId, businessUserId, hubspotContactId: m.hubspotContactId, lifecycleStage: m.lifecycleStage },
    update: { hubspotContactId: m.hubspotContactId, lifecycleStage: m.lifecycleStage },
  });
}

/** Upsert the tenant-scoped Deal. Returns the Deal row. */
export async function upsertDeal(prisma, tenantId, hsDeal, stageMap, accountId) {
  const m = mapHsDeal(hsDeal, stageMap);
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
    syncedAt: new Date(),
  };
  return prisma.deal.upsert({
    where: { tenantId_hubspotDealId: { tenantId, hubspotDealId: m.hubspotDealId } },
    create: { tenantId, hubspotDealId: m.hubspotDealId, ...data },
    update: data,
  });
}

async function linkDealContacts(prisma, dealId, contactIds) {
  for (const contactId of contactIds) {
    await prisma.dealContact.upsert({
      where: { dealId_contactId: { dealId, contactId } },
      create: { dealId, contactId },
      update: {},
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

  const dealsRes = await searchOpenDeals(token, { fetchImpl });
  if (!dealsRes.ok && dealsRes.status === 401) {
    return { ok: false, error: "hubspot_auth", counts };
  }

  for (const hsDeal of dealsRes.results) {
    const assoc = dedupeAssociations(await getDealAssociations(token, hsDeal.id, { fetchImpl }));

    let accountId = null;
    if (assoc.companies.length) {
      const companies = await getCompaniesByIds(token, assoc.companies, { fetchImpl });
      for (const hsCo of companies) {
        const account = await upsertAccount(prisma, tenantId, hsCo);
        counts.accounts++;
        if (!accountId) accountId = account.id; // first associated company is primary
      }
    }

    const deal = await upsertDeal(prisma, tenantId, hsDeal, stageMap, accountId);
    counts.deals++;

    if (assoc.contacts.length) {
      const contacts = await getContactsByIds(token, assoc.contacts, { fetchImpl });
      const contactIds = [];
      for (const hsC of contacts) {
        const contact = await upsertContact(prisma, tenantId, hsC);
        contactIds.push(contact.id);
        counts.contacts++;
      }
      await linkDealContacts(prisma, deal.id, contactIds);
      counts.dealContacts += contactIds.length;
    }
  }

  const mql = await searchMqlContacts(token, { fetchImpl });
  for (const hsC of mql.results) {
    await upsertContact(prisma, tenantId, hsC);
    counts.leads++;
  }

  return { ok: true, counts };
}

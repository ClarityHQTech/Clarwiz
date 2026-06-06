import { prisma as defaultPrisma } from "@/lib/prisma";

// Tenant-wide Company / Contact directory, aggregated from each deal's cached
// HubSpot associations (deal -> company, deal -> contacts).

const DECISION_TITLES = /(chief|ceo|cfo|cto|coo|founder|owner|president|chairperson|vp|vice president|head of|director)/i;
const INFLUENCER_TITLES = /(manager|lead|principal|senior|architect|specialist)/i;

export function personaFromTitle(title) {
  if (!title) return "OTHER";
  if (DECISION_TITLES.test(title)) return "DECISION_MAKER";
  if (INFLUENCER_TITLES.test(title)) return "INFLUENCER";
  return "OTHER";
}

export async function getTenantCompanies({ tenantId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const deals = await prisma.deal.findMany({ where: { tenantId }, include: { context: true } });
  const map = new Map();
  for (const d of deals) {
    const c = d.context?.data?.cached?.company;
    if (c?.id) {
      const e = map.get(c.id) ?? { ...c, dealCount: 0, deals: [] };
      e.dealCount += 1;
      if (d.name) e.deals.push({ hubspotDealId: d.hubspotDealId, name: d.name });
      map.set(c.id, e);
    }
  }
  const companies = Array.from(map.values());
  for (const co of companies) {
    const ci = await prisma.dealInsight.findFirst({
      where: { tenantId, companyId: co.id, scope: "COMPANY" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    co.hasInsight = !!ci;
  }
  return companies;
}

export async function getTenantContacts({ tenantId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const deals = await prisma.deal.findMany({ where: { tenantId }, include: { context: true } });
  const map = new Map();
  for (const d of deals) {
    const contacts = d.context?.data?.cached?.contacts ?? [];
    for (const ct of contacts) {
      if (!ct?.id) continue;
      const e = map.get(ct.id) ?? { ...ct, persona: personaFromTitle(ct.title), deals: [] };
      if (d.name) e.deals.push({ hubspotDealId: d.hubspotDealId, name: d.name });
      map.set(ct.id, e);
    }
  }
  return Array.from(map.values());
}

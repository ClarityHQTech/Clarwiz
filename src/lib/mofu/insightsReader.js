import { prisma as defaultPrisma } from "@/lib/prisma";
import { gateCard } from "@/lib/mofu/capabilities";
import { personaFromTitle } from "@/lib/mofu/directory";

const iso = (d) => (d ? new Date(d).toISOString() : null);

function serializeInsight(i) {
  if (!i) return null;
  return {
    id: i.id,
    scope: i.scope,
    executiveSummary: i.executiveSummary,
    dimensions: {
      stakeholder: i.stakeholderIntelligence,
      value: i.valueIntelligence,
      risk: i.riskIntelligence,
      temporal: i.temporalIntelligence,
      competitive: i.competitiveIntelligence,
      expansion: i.expansionIntelligence,
    },
    recommendations: i.actionableRecommendations,
    systemMetadata: i.systemMetadata,
    createdAt: iso(i.createdAt),
  };
}

function serializeSignal(s) {
  return {
    id: s.id,
    kind: s.kind,
    source: s.source,
    summary: s.summary,
    score: s.score,
    signalReferenceId: s.signalReferenceId,
    occurredAt: iso(s.occurredAt),
  };
}

function serializeCard(r, presentMap) {
  return {
    id: r.id,
    actionType: r.actionType,
    title: r.title,
    score: r.score,
    status: r.status,
    signalReferenceId: r.signalReferenceId,
    payload: r.payload,
    gate: gateCard(r.actionType, presentMap),
    createdAt: iso(r.createdAt),
  };
}

/**
 * Read-side for the Deal/Company Insights pages (US-9.1/9.2). Same shape for both
 * scopes. Returns the latest Heptapod bundle + scored signals + capability-gated
 * NBA cards. Tenant-scoped; unknown deal -> not_found.
 */
export async function getDealInsights({ tenantId, hubspotDealId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const deal = await prisma.deal.findUnique({
    where: { tenantId_hubspotDealId: { tenantId, hubspotDealId } },
    include: { context: true },
  });
  if (!deal) return { ok: false, reason: "deal_not_found" };

  const [insight, signals, recs, caps] = await Promise.all([
    prisma.dealInsight.findFirst({
      where: { tenantId, dealId: deal.id, scope: "DEAL" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dealSignal.findMany({ where: { tenantId, dealId: deal.id }, orderBy: { score: "desc" }, take: 50 }),
    prisma.nbaRecommendation.findMany({
      where: { tenantId, dealId: deal.id, status: { not: "DISMISSED" } },
      orderBy: { score: "desc" },
    }),
    prisma.tenantCapability.findMany({ where: { tenantId } }),
  ]);

  const presentMap = Object.fromEntries(caps.map((c) => [c.capability, c.present]));

  // Company + contact level (from cached associations + COMPANY-scoped bundle).
  const cached = deal.context?.data?.cached ?? {};
  const company = cached.company ?? null;
  const contacts = Array.isArray(cached.contacts) ? cached.contacts : [];
  let companyInsight = null;
  if (company?.id) {
    const ci = await prisma.dealInsight.findFirst({
      where: { tenantId, companyId: company.id, scope: "COMPANY" },
      orderBy: { createdAt: "desc" },
    });
    companyInsight = serializeInsight(ci);
  }

  return {
    ok: true,
    deal: {
      id: deal.id,
      hubspotDealId: deal.hubspotDealId,
      name: deal.name,
      cachedStage: deal.cachedStage,
      cachedAmount: deal.cachedAmount,
      cachedCurrency: deal.cachedCurrency,
      source: deal.source,
      autopilot: deal.autopilot,
      lastSyncedAt: iso(deal.context?.lastSyncedAt),
    },
    company,
    contacts,
    companyInsight,
    insight: serializeInsight(insight),
    signals: signals.map(serializeSignal),
    cards: recs.map((r) => serializeCard(r, presentMap)),
  };
}

/**
 * Contact-level (derived) view — no extra LLM call. Combines the deal bundle's
 * stakeholder profile for this contact + the contact's own signals + persona.
 */
export async function getContactInsight({ tenantId, dealId, contactId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId }, include: { context: true } });
  if (!deal) return { ok: false, reason: "deal_not_found" };
  const contact = (deal.context?.data?.cached?.contacts ?? []).find((c) => String(c.id) === String(contactId));
  if (!contact) return { ok: false, reason: "contact_not_found" };

  const [insight, signals] = await Promise.all([
    prisma.dealInsight.findFirst({ where: { tenantId, dealId, scope: "DEAL" }, orderBy: { createdAt: "desc" } }),
    prisma.dealSignal.findMany({ where: { tenantId, dealId, contactId: String(contactId) }, orderBy: { score: "desc" }, take: 20 }),
  ]);
  const profiles = insight?.stakeholderIntelligence?.individual_profiles ?? [];
  const ai = profiles.find((p) => String(p.name || "").toLowerCase() === String(contact.name || "").toLowerCase()) ?? null;

  return {
    ok: true,
    contact: {
      id: contact.id,
      name: contact.name,
      title: contact.title ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      persona: personaFromTitle(contact.title),
      role_type: ai?.role_type ?? null,
      influence_level: ai?.influence_level ?? null,
      engagement_status: ai?.engagement_status ?? null,
      recommended_approach: ai?.engagement_strategy ?? null,
    },
    signals: signals.map((s) => ({ id: s.id, kind: s.kind, summary: s.summary, score: s.score, occurredAt: iso(s.occurredAt) })),
  };
}

export async function getCompanyInsights({ tenantId, companyId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const deals = await prisma.deal.findMany({ where: { tenantId }, include: { context: true } });

  let companyInfo = null;
  const companyDeals = [];
  const contacts = [];
  for (const d of deals) {
    const c = d.context?.data?.cached?.company;
    if (c?.id !== companyId) continue;
    companyInfo = companyInfo ?? c;
    companyDeals.push({ hubspotDealId: d.hubspotDealId, name: d.name, stage: d.cachedStage, amount: d.cachedAmount, currency: d.cachedCurrency });
    for (const ct of d.context?.data?.cached?.contacts ?? []) {
      if (ct?.id && !contacts.find((x) => x.id === ct.id)) contacts.push({ ...ct, persona: personaFromTitle(ct.title) });
    }
  }
  if (!companyInfo) return { ok: false, reason: "company_not_found" };

  const insight = await prisma.dealInsight.findFirst({
    where: { tenantId, companyId, scope: "COMPANY" },
    orderBy: { createdAt: "desc" },
  });

  return {
    ok: true,
    company: { ...companyInfo, dealCount: companyDeals.length },
    insight: serializeInsight(insight),
    deals: companyDeals,
    contacts,
  };
}

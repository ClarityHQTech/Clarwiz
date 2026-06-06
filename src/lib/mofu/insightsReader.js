import { prisma as defaultPrisma } from "@/lib/prisma";
import { gateCard } from "@/lib/mofu/capabilities";

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

export async function getCompanyInsights({ tenantId, companyId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const [insight, caps] = await Promise.all([
    prisma.dealInsight.findFirst({
      where: { tenantId, companyId, scope: "COMPANY" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenantCapability.findMany({ where: { tenantId } }),
  ]);
  if (!insight) return { ok: false, reason: "company_insight_not_found" };
  return { ok: true, company: { companyId }, insight: serializeInsight(insight), signals: [], cards: [] };
}

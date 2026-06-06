import { prisma as defaultPrisma } from "@/lib/prisma";

// US-10.1 — Operator dashboard data: what's happening across deals.
export async function getOperatorDashboard({ tenantId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const [deals, signals, bundles, recs] = await Promise.all([
    prisma.deal.count({ where: { tenantId } }),
    prisma.dealSignal.count({ where: { tenantId } }),
    prisma.dealInsight.count({ where: { tenantId } }),
    prisma.nbaRecommendation.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(recs.map((r) => [r.status, r._count._all]));
  return {
    stats: {
      deals,
      signals,
      bundles,
      suggested: byStatus.SUGGESTED ?? 0,
      approved: byStatus.APPROVED ?? 0,
      sent: byStatus.SENT ?? 0,
      failed: byStatus.FAILED ?? 0,
    },
  };
}

export async function getMofuDeals({ tenantId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const deals = await prisma.deal.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { recommendations: true, signals: true } },
      recommendations: { orderBy: { score: "desc" }, take: 1 },
      signals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return deals.map((d) => {
    const top = (d.recommendations || [])[0];
    const sig = (d.signals || [])[0];
    return {
      id: d.id,
      hubspotDealId: d.hubspotDealId,
      name: d.name,
      stage: d.cachedStage,
      amount: d.cachedAmount,
      currency: d.cachedCurrency,
      source: d.source,
      autopilot: d.autopilot,
      recommendationCount: d._count.recommendations,
      signalCount: d._count.signals,
      topNba: top ? { title: top.title, actionType: top.actionType, score: top.score, status: top.status } : null,
      lastSignal: sig ? { kind: sig.kind, at: sig.createdAt ? new Date(sig.createdAt).toISOString() : null } : null,
    };
  });
}

export async function getActivityFeed({ tenantId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const dealSel = { select: { name: true, hubspotDealId: true } };
  const [signals, recs] = await Promise.all([
    prisma.dealSignal.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8, include: { deal: dealSel } }),
    prisma.nbaRecommendation.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8, include: { deal: dealSel } }),
  ]);
  const items = [];
  for (const s of signals) {
    items.push({ type: "signal", kind: s.kind, deal: s.deal?.name ?? "Deal", text: s.summary ?? s.kind, at: s.createdAt });
  }
  for (const r of recs) {
    const type = r.status === "SENT" ? "exec" : r.status === "FAILED" ? "fail" : "nba";
    items.push({ type, deal: r.deal?.name ?? "Deal", text: r.title, actionType: r.actionType, status: r.status, at: r.executedAt ?? r.createdAt });
  }
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  return items.slice(0, 12).map((i) => ({ ...i, at: i.at ? new Date(i.at).toISOString() : null }));
}

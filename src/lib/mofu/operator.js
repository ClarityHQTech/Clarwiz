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
    include: { _count: { select: { recommendations: true, signals: true } } },
  });
  return deals.map((d) => ({
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
  }));
}

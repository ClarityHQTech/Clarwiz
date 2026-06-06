import { prisma as defaultPrisma } from "@/lib/prisma";
import { hydrateDeal as defaultHydrate } from "@/lib/mofu/hydrateDeal";
import { computeInsightBundle as defaultBundle } from "@/lib/mofu/insightBundle";
import { computeNba as defaultNba } from "@/lib/mofu/nbaBrain";
import { discoverCapabilities as defaultDiscover } from "@/lib/mofu/capabilities";

/**
 * The MOFU core loop for one deal: CONTEXT -> NBA. Used by recompute orchestration
 * (Epic 13 webhooks), on-demand "suggest now", and the brain route. Every external
 * dependency is injectable for tests. Not-connected/hydrate failure short-circuits.
 */
export async function recomputeDeal({ tenantId, hubspotDealId, tenantIcp = null }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const hydrateDeal = deps.hydrateDeal ?? defaultHydrate;
  const computeInsightBundle = deps.computeInsightBundle ?? defaultBundle;
  const computeNba = deps.computeNba ?? defaultNba;
  const discoverCapabilities = deps.discoverCapabilities ?? defaultDiscover;

  const hydrate = await hydrateDeal({ tenantId, hubspotDealId }, deps.hydrateDeps);
  if (!hydrate.ok) return { ok: false, reason: hydrate.reason };

  const dealId = hydrate.dealId;
  const signals = await prisma.dealSignal.findMany({
    where: { tenantId, dealId },
    orderBy: { score: "desc" },
    take: 50,
  });

  const bundleOut = await computeInsightBundle(
    { tenantId, scope: "DEAL", dealId, context: hydrate.context, signals, tenantIcp },
    deps.bundleDeps
  );
  const nbaOut = await computeNba(
    { tenantId, dealId, bundle: bundleOut.bundle, signals },
    deps.nbaDeps
  );
  const caps = await discoverCapabilities(tenantId, deps.capDeps);

  await prisma.dealSignal.updateMany({
    where: { tenantId, dealId, processedForNbaAt: null },
    data: { processedForNbaAt: new Date() },
  });

  return {
    ok: true,
    dealId,
    insightId: bundleOut.insightId,
    recommendationCount: nbaOut.recommendations.length,
    capabilities: caps.present,
    warning: hydrate.warning ?? null,
  };
}

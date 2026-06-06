import { prisma as defaultPrisma } from "@/lib/prisma";
import { hydrateDeal as defaultHydrate } from "@/lib/mofu/hydrateDeal";
import { computeInsightBundle as defaultBundle } from "@/lib/mofu/insightBundle";
import { computeNba as defaultNba } from "@/lib/mofu/nbaBrain";
import { discoverCapabilities as defaultDiscover } from "@/lib/mofu/capabilities";
import { ingestSignal as defaultIngest } from "@/lib/mofu/ingestSignal";
import { runAutopilot as defaultAutopilot } from "@/lib/mofu/autopilot";
import { buildOntology } from "@/lib/mofu/contextOntology";

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

  // Backfill HubSpot engagements (emails/calls/meetings/notes) as scored signals.
  const ingestSignal = deps.ingestSignal ?? defaultIngest;
  const engagements = hydrate.context?.cached?.engagements ?? [];
  for (const e of engagements) {
    if (!e?.externalId || !e?.kind) continue;
    await ingestSignal(
      { tenantId, dealId, kind: e.kind, source: "hubspot", externalId: e.externalId, summary: e.summary, occurredAt: e.occurredAt, contactId: e.contactId ?? null },
      deps.ingestDeps
    );
  }

  const signals = await prisma.dealSignal.findMany({
    where: { tenantId, dealId },
    orderBy: { score: "desc" },
    take: 50,
  });

  // Assemble the explicit ontology (company → contacts → engagements → signals)
  // that grounds the Heptapod bundle (Aura-grade context).
  const dealRow = prisma.deal?.findUnique
    ? await prisma.deal.findUnique({ where: { id: dealId } })
    : null;
  const cached = hydrate.context?.cached ?? {};
  const ontology = buildOntology({
    deal: { name: dealRow?.name, stage: hydrate.context?.live?.stage ?? dealRow?.cachedStage, amount: hydrate.context?.live?.amount ?? dealRow?.cachedAmount, currency: hydrate.context?.live?.currency ?? dealRow?.cachedCurrency },
    company: cached.company,
    contacts: cached.contacts ?? [],
    engagements,
    signals,
    tenantIcp,
  });

  const bundleOut = await computeInsightBundle(
    { tenantId, scope: "DEAL", dealId, context: ontology, signals, tenantIcp },
    deps.bundleDeps
  );

  // Company-level intelligence (US-9.2): compute a COMPANY-scoped bundle when the
  // deal has an associated company.
  const company = hydrate.context?.cached?.company;
  if (company?.id) {
    await computeInsightBundle(
      {
        tenantId,
        scope: "COMPANY",
        companyId: company.id,
        context: { company, contacts: hydrate.context?.cached?.contacts ?? [] },
        signals: [],
        tenantIcp,
      },
      deps.bundleDeps
    ).catch(() => {});
  }

  const nbaOut = await computeNba(
    { tenantId, dealId, bundle: bundleOut.bundle, signals },
    deps.nbaDeps
  );
  const caps = await discoverCapabilities(tenantId, deps.capDeps);

  // Autopilot: auto-execute allowlisted internal actions when the deal opts in.
  let autopilot = null;
  if (dealRow?.autopilot && nbaOut.recommendations.length) {
    const runAutopilot = deps.runAutopilot ?? defaultAutopilot;
    autopilot = await runAutopilot({ tenantId, recommendations: nbaOut.recommendations }, deps.autopilotDeps);
  }

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
    autopilot,
    warning: hydrate.warning ?? null,
  };
}

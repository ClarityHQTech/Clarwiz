import { prisma as defaultPrisma } from "@/lib/prisma";
import { getSorAdapter } from "@/lib/sor/SorAdapter";

// Slow-intel freshness window. Volatile fields (stage/owner/amount) are ALWAYS
// read live; only cached intel is gated by this.
const STALE_MS = 1000 * 60 * 30; // 30 min

/**
 * US-1.1 — Hybrid hydrate. Reads volatile HubSpot fields live every call and
 * caches slow intel on DealContext. Behind the single SorAdapter seam.
 *   - not connected            -> { ok:false, reason:"sor_not_connected" } (connect CTA)
 *   - hard error w/ prior cache -> { ok:true, warning:"stale_context", ... } (brain still runs)
 *   - hard error w/o cache      -> { ok:false, reason }
 * Volatile fields are snapshotted onto Deal.cached* but are never read as authoritative.
 */
export async function hydrateDeal({ tenantId, hubspotDealId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const adapter = deps.adapter ?? getSorAdapter();

  const result = await adapter.getDeal(tenantId, hubspotDealId);

  // Not connected: surface a connect CTA, no pointer side effects.
  if (!result.ok && result.reason === "sor_not_connected") {
    return { ok: false, reason: "sor_not_connected" };
  }

  // Ensure the Deal pointer exists so we can fall back to cache on hard errors.
  const deal = await prisma.deal.upsert({
    where: { tenantId_hubspotDealId: { tenantId, hubspotDealId } },
    create: { tenantId, hubspotDealId, source: "HUBSPOT_MQL" },
    update: {},
  });

  if (!result.ok) {
    // Retries already exhausted in the client -> last cached context + warning.
    const existing = await prisma.dealContext.findUnique({ where: { dealId: deal.id } });
    if (existing) {
      return {
        ok: true,
        dealId: deal.id,
        warning: "stale_context",
        context: { live: null, cached: existing.data?.cached ?? {} },
        lastSyncedAt: existing.lastSyncedAt,
      };
    }
    return { ok: false, reason: result.reason };
  }

  const live = result.deal.live;

  // Snapshot volatile fields (NEVER authoritative for decisions).
  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      name: result.deal.name ?? undefined,
      cachedStage: live.stage,
      cachedOwner: live.owner,
      cachedAmount: live.amount ?? undefined,
      cachedCurrency: live.currency,
      stageSnapshotAt: new Date(),
    },
  });

  // Refresh slow intel only when stale.
  const existing = await prisma.dealContext.findUnique({ where: { dealId: deal.id } });
  const isStale =
    !existing || Date.now() - new Date(existing.lastSyncedAt).getTime() > STALE_MS;
  let cached = existing?.data?.cached ?? {};
  if (isStale) {
    const eng = await adapter.getDealEngagements(tenantId, hubspotDealId);
    cached = { ...cached, engagements: eng.ok ? eng.items : cached.engagements ?? [] };
    await prisma.dealContext.upsert({
      where: { dealId: deal.id },
      create: { tenantId, dealId: deal.id, data: { cached }, lastSyncedAt: new Date() },
      update: { data: { cached }, lastSyncedAt: new Date() },
    });
  }

  return { ok: true, dealId: deal.id, context: { live, cached }, lastSyncedAt: new Date() };
}

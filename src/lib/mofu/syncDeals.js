import { getSorAdapter } from "@/lib/sor/SorAdapter";
import { hydrateDeal as defaultHydrate } from "@/lib/mofu/hydrateDeal";

/**
 * Pull deals from HubSpot and hydrate each into Clarwiz (Deal pointer + DealContext).
 * Lets the MOFU dashboard populate from the real portal without per-deal lookups.
 */
export async function syncDealsFromHubSpot({ tenantId, limit = 50 }, deps = {}) {
  const adapter = deps.adapter ?? getSorAdapter();
  const hydrateDeal = deps.hydrateDeal ?? defaultHydrate;

  const list = await adapter.listDeals(tenantId, { limit });
  if (!list.ok) return { ok: false, reason: list.reason };

  let hydrated = 0;
  for (const d of list.deals) {
    const r = await hydrateDeal({ tenantId, hubspotDealId: d.hubspotDealId });
    if (r.ok) hydrated += 1;
  }
  return { ok: true, total: list.deals.length, hydrated };
}

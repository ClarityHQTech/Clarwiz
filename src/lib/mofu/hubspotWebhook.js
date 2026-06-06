import { prisma as defaultPrisma } from "@/lib/prisma";
import { ingestSignal as defaultIngest } from "@/lib/mofu/ingestSignal";

// Map a HubSpot webhook event to a closed DealSignal kind.
export function mapEventKind(ev) {
  const t = String(ev?.subscriptionType || ev?.eventType || ev?.propertyName || "").toLowerCase();
  if (t.includes("dealstage") || t.includes("deal.propertychange")) return "STAGE_CHANGE";
  if (t.includes("transcript") || t.includes("call")) return "CALL_TRANSCRIPT";
  if (t.includes("email")) return "EMAIL";
  if (t.includes("meeting")) return "MEETING";
  if (t.includes("note")) return "NOTE";
  return null;
}

/**
 * US-13.1 — Process HubSpot webhook events: ingest a DealSignal and re-trigger the
 * brain for the matched deal. Unmatchable events are stored as skipped/unlinked
 * (warning), never throw. Recompute is awaited only when a recompute fn is injected.
 */
export async function handleHubSpotWebhook({ tenantId, events = [] }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const ingestSignal = deps.ingestSignal ?? defaultIngest;
  const results = [];
  const recomputed = new Set();

  for (const ev of events) {
    // Contact changes: refresh the affected deals' cached contacts + recompute.
    const subType = String(ev?.subscriptionType || "").toLowerCase();
    if (subType.startsWith("contact.")) {
      const contactId = String(ev?.objectId ?? "");
      const deals = await prisma.deal.findMany({ where: { tenantId }, include: { context: true } });
      const affected = deals.filter((d) => (d.context?.data?.cached?.contacts ?? []).some((c) => String(c.id) === contactId));
      for (const d of affected) {
        // Force the next hydrate to re-pull associations (mark cache stale).
        await prisma.dealContext.updateMany({ where: { dealId: d.id }, data: { lastSyncedAt: new Date(0) } });
        if (deps.recompute && !recomputed.has(d.id)) {
          recomputed.add(d.id);
          await deps.recompute({ tenantId, hubspotDealId: d.hubspotDealId }).catch(() => {});
        }
      }
      results.push({ ok: true, contactEvent: true, contactId, affected: affected.length });
      continue;
    }

    const kind = mapEventKind(ev);
    const hubspotDealId = String(ev?.objectId ?? ev?.dealId ?? "");
    if (!kind || !hubspotDealId) {
      results.push({ skipped: true, reason: "unmappable", unlinked: true });
      continue;
    }
    const deal = await prisma.deal.findUnique({
      where: { tenantId_hubspotDealId: { tenantId, hubspotDealId } },
    });
    if (!deal) {
      results.push({ skipped: true, reason: "deal_not_tracked", hubspotDealId, unlinked: true });
      continue;
    }
    const ing = await ingestSignal(
      {
        tenantId,
        dealId: deal.id,
        kind,
        source: "hubspot",
        externalId: String(ev.eventId ?? `${ev.objectId}:${ev.occurredAt ?? ""}`),
        summary: ev.propertyName ? `${ev.propertyName}=${ev.propertyValue ?? ""}` : null,
        occurredAt: ev.occurredAt ? new Date(Number(ev.occurredAt) || ev.occurredAt).toISOString() : null,
      },
      deps.ingestDeps
    );

    // Debounce recompute: at most once per deal per batch.
    if (deps.recompute && !recomputed.has(deal.id)) {
      recomputed.add(deal.id);
      try {
        await deps.recompute({ tenantId, hubspotDealId });
      } catch {
        /* recompute failure is non-fatal for the webhook */
      }
    }
    results.push({ ok: ing.ok, dealId: deal.id, kind });
  }
  return { processed: results.length, results };
}

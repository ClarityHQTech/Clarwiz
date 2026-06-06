import { describe, it, expect, vi } from "vitest";
import { mapEventKind, handleHubSpotWebhook } from "@/lib/mofu/hubspotWebhook";

describe("hubspot webhook (US-13.1)", () => {
  it("maps subscription types to closed signal kinds", () => {
    expect(mapEventKind({ subscriptionType: "deal.propertyChange", propertyName: "dealstage" })).toBe("STAGE_CHANGE");
    expect(mapEventKind({ subscriptionType: "call.transcript" })).toBe("CALL_TRANSCRIPT");
    expect(mapEventKind({ subscriptionType: "weird.thing" })).toBeNull();
  });

  it("ingests a signal and recomputes once per deal", async () => {
    const prisma = {
      deal: { findUnique: vi.fn(async () => ({ id: "deal_1", hubspotDealId: "d1" })) },
    };
    const ingestSignal = vi.fn(async () => ({ ok: true }));
    const recompute = vi.fn(async () => ({ ok: true }));
    const out = await handleHubSpotWebhook(
      {
        tenantId: "t1",
        events: [
          { subscriptionType: "call.transcript", objectId: "d1", eventId: "e1", occurredAt: 1717632000000 },
          { subscriptionType: "deal.propertyChange", propertyName: "dealstage", objectId: "d1", eventId: "e2" },
        ],
      },
      { prisma, ingestSignal, recompute }
    );
    expect(out.processed).toBe(2);
    expect(ingestSignal).toHaveBeenCalledTimes(2);
    expect(recompute).toHaveBeenCalledTimes(1); // debounced per deal
  });

  it("stores unmatchable / untracked events as skipped+unlinked (no throw)", async () => {
    const prisma = { deal: { findUnique: vi.fn(async () => null) } };
    const out = await handleHubSpotWebhook(
      { tenantId: "t1", events: [{ subscriptionType: "call.transcript", objectId: "unknown", eventId: "e9" }, { subscriptionType: "weird" }] },
      { prisma, ingestSignal: vi.fn(), recompute: vi.fn() }
    );
    expect(out.results[0]).toMatchObject({ skipped: true, reason: "deal_not_tracked", unlinked: true });
    expect(out.results[1]).toMatchObject({ skipped: true, reason: "unmappable" });
  });
});

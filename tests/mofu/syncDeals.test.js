import { describe, it, expect, vi } from "vitest";
import { syncDealsFromHubSpot } from "@/lib/mofu/syncDeals";

describe("syncDealsFromHubSpot", () => {
  it("lists HubSpot deals and hydrates each", async () => {
    const adapter = {
      listDeals: vi.fn(async () => ({ ok: true, deals: [{ hubspotDealId: "d1" }, { hubspotDealId: "d2" }] })),
    };
    const hydrateDeal = vi.fn(async () => ({ ok: true }));
    const out = await syncDealsFromHubSpot({ tenantId: "t1" }, { adapter, hydrateDeal });
    expect(out).toMatchObject({ ok: true, total: 2, hydrated: 2 });
    expect(hydrateDeal).toHaveBeenCalledTimes(2);
  });

  it("surfaces not-connected", async () => {
    const adapter = { listDeals: vi.fn(async () => ({ ok: false, reason: "sor_not_connected" })) };
    const out = await syncDealsFromHubSpot({ tenantId: "t1" }, { adapter });
    expect(out).toMatchObject({ ok: false, reason: "sor_not_connected" });
  });
});

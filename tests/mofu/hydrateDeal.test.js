import { describe, it, expect, vi } from "vitest";
import { hydrateDeal } from "@/lib/mofu/hydrateDeal";

function fakeDeps({ adapterResult, existingContext = null }) {
  const deal = { id: "deal_1", tenantId: "t1", hubspotDealId: "d1" };
  const prisma = {
    deal: {
      upsert: vi.fn(async () => deal),
      update: vi.fn(async () => deal),
    },
    dealContext: {
      findUnique: vi.fn(async () => existingContext),
      upsert: vi.fn(async (a) => ({ id: "ctx_1", ...a.create })),
    },
  };
  const adapter = {
    getDeal: vi.fn(async () => adapterResult),
    getDealEngagements: vi.fn(async () => ({ ok: true, items: [] })),
  };
  return { prisma, adapter };
}

describe("hydrateDeal (US-1.1)", () => {
  it("not connected -> structured no-op, no pointer write", async () => {
    const { prisma, adapter } = fakeDeps({ adapterResult: { ok: false, reason: "sor_not_connected" } });
    const out = await hydrateDeal({ tenantId: "t1", hubspotDealId: "d1" }, { prisma, adapter });
    expect(out).toMatchObject({ ok: false, reason: "sor_not_connected" });
    expect(prisma.deal.upsert).not.toHaveBeenCalled();
  });

  it("happy path returns live fields + creates pointer/context", async () => {
    const { prisma, adapter } = fakeDeps({
      adapterResult: {
        ok: true,
        deal: {
          hubspotDealId: "d1",
          name: "Acme",
          live: { stage: "qualifiedtobuy", owner: "55", amount: 12000, currency: "USD", timeline: [] },
          raw: {},
        },
      },
    });
    const out = await hydrateDeal({ tenantId: "t1", hubspotDealId: "d1" }, { prisma, adapter });
    expect(out.ok).toBe(true);
    expect(out.context.live.stage).toBe("qualifiedtobuy");
    expect(prisma.deal.upsert).toHaveBeenCalled();
    expect(prisma.deal.update).toHaveBeenCalled(); // volatile snapshot
    expect(prisma.dealContext.upsert).toHaveBeenCalled();
  });

  it("hard error WITH existing context -> stale_context warning, brain still runs", async () => {
    const { prisma, adapter } = fakeDeps({
      adapterResult: { ok: false, reason: "hubspot_unavailable" },
      existingContext: { dealId: "deal_1", data: { cached: { engagements: [] } }, lastSyncedAt: new Date() },
    });
    const out = await hydrateDeal({ tenantId: "t1", hubspotDealId: "d1" }, { prisma, adapter });
    expect(out.ok).toBe(true);
    expect(out.warning).toBe("stale_context");
  });

  it("hard error WITHOUT cache -> ok:false with reason", async () => {
    const { prisma, adapter } = fakeDeps({ adapterResult: { ok: false, reason: "hubspot_unavailable" } });
    const out = await hydrateDeal({ tenantId: "t1", hubspotDealId: "d1" }, { prisma, adapter });
    expect(out).toMatchObject({ ok: false, reason: "hubspot_unavailable" });
  });
});

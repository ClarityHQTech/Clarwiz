import { describe, it, expect, vi } from "vitest";
import { recomputeDeal } from "@/lib/mofu/recompute";

describe("recomputeDeal (core loop)", () => {
  it("short-circuits when hydrate is not connected", async () => {
    const out = await recomputeDeal(
      { tenantId: "t1", hubspotDealId: "d1" },
      { hydrateDeal: async () => ({ ok: false, reason: "sor_not_connected" }) }
    );
    expect(out).toMatchObject({ ok: false, reason: "sor_not_connected" });
  });

  it("runs hydrate -> bundle -> nba -> capabilities and marks signals processed", async () => {
    const prisma = {
      dealSignal: {
        findMany: vi.fn(async () => [{ id: "s1", signalReferenceId: "r1", kind: "EMAIL", score: 1 }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const out = await recomputeDeal(
      { tenantId: "t1", hubspotDealId: "d1" },
      {
        prisma,
        hydrateDeal: async () => ({ ok: true, dealId: "deal_1", context: { live: {}, cached: {} } }),
        computeInsightBundle: async () => ({ insightId: "i1", bundle: { actionable_recommendations: [] } }),
        computeNba: async () => ({ recommendations: [{ id: "rec1" }] }),
        discoverCapabilities: async () => ({ present: { EMAIL: true } }),
      }
    );
    expect(out).toMatchObject({ ok: true, dealId: "deal_1", insightId: "i1", recommendationCount: 1 });
    expect(out.capabilities.EMAIL).toBe(true);
    expect(prisma.dealSignal.updateMany).toHaveBeenCalled();
  });
});

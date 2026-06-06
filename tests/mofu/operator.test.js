import { describe, it, expect, vi } from "vitest";
import { getOperatorDashboard, getMofuDeals } from "@/lib/mofu/operator";

describe("operator dashboard (US-10.1)", () => {
  it("aggregates stats including NBA status breakdown", async () => {
    const prisma = {
      deal: { count: vi.fn(async () => 3) },
      dealSignal: { count: vi.fn(async () => 12) },
      dealInsight: { count: vi.fn(async () => 3) },
      nbaRecommendation: {
        groupBy: vi.fn(async () => [
          { status: "SUGGESTED", _count: { _all: 5 } },
          { status: "SENT", _count: { _all: 2 } },
          { status: "FAILED", _count: { _all: 1 } },
        ]),
      },
    };
    const out = await getOperatorDashboard({ tenantId: "t1" }, { prisma });
    expect(out.stats).toMatchObject({ deals: 3, signals: 12, bundles: 3, suggested: 5, sent: 2, failed: 1 });
  });

  it("lists deals with counts", async () => {
    const prisma = {
      deal: {
        findMany: vi.fn(async () => [
          { id: "deal_1", hubspotDealId: "d1", name: "Acme", cachedStage: "qualifiedtobuy", cachedAmount: 1000, source: "HUBSPOT_MQL", autopilot: false, _count: { recommendations: 2, signals: 4 } },
        ]),
      },
    };
    const out = await getMofuDeals({ tenantId: "t1" }, { prisma });
    expect(out[0]).toMatchObject({ hubspotDealId: "d1", name: "Acme", recommendationCount: 2, signalCount: 4 });
  });
});

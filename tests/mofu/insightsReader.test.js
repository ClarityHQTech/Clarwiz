import { describe, it, expect, vi } from "vitest";
import { getDealInsights } from "@/lib/mofu/insightsReader";

describe("getDealInsights (US-9.1)", () => {
  it("returns deal + bundle + signals + capability-gated cards", async () => {
    const prisma = {
      deal: {
        findUnique: vi.fn(async () => ({
          id: "deal_1",
          hubspotDealId: "d1",
          name: "Acme",
          cachedStage: "qualifiedtobuy",
          context: { lastSyncedAt: new Date() },
        })),
      },
      dealInsight: {
        findFirst: vi.fn(async () => ({
          id: "i1",
          scope: "DEAL",
          stakeholderIntelligence: { summary: "x" },
          actionableRecommendations: [],
          systemMetadata: { confidence: 0.7 },
          createdAt: new Date(),
        })),
      },
      dealSignal: {
        findMany: vi.fn(async () => [
          { id: "s1", kind: "CALL_TRANSCRIPT", source: "hubspot", summary: "call", score: 1.3, signalReferenceId: "r1", occurredAt: new Date() },
        ]),
      },
      nbaRecommendation: {
        findMany: vi.fn(async () => [
          { id: "rec1", actionType: "SEND_EMAIL", title: "Follow up", score: 0.9, status: "SUGGESTED", signalReferenceId: "r1", payload: {}, createdAt: new Date() },
          { id: "rec2", actionType: "PREP_MEETING", title: "Prep", score: 0.5, status: "SUGGESTED", signalReferenceId: "r2", payload: {}, createdAt: new Date() },
        ]),
      },
      tenantCapability: {
        findMany: vi.fn(async () => [{ capability: "EMAIL", present: false }]),
      },
    };
    const out = await getDealInsights({ tenantId: "t1", hubspotDealId: "d1" }, { prisma });
    expect(out.ok).toBe(true);
    expect(out.deal.name).toBe("Acme");
    expect(out.insight.dimensions.stakeholder.summary).toBe("x");
    expect(out.signals).toHaveLength(1);
    // EMAIL capability absent -> SEND_EMAIL card gates to a connect CTA
    const email = out.cards.find((c) => c.actionType === "SEND_EMAIL");
    expect(email.gate.executable).toBe(false);
    expect(email.gate.cta).toBe("Connect EMAIL to HubSpot");
    // PREP_MEETING needs no capability -> executable
    const prep = out.cards.find((c) => c.actionType === "PREP_MEETING");
    expect(prep.gate.executable).toBe(true);
  });

  it("unknown deal -> not_found", async () => {
    const prisma = { deal: { findUnique: vi.fn(async () => null) } };
    const out = await getDealInsights({ tenantId: "t1", hubspotDealId: "nope" }, { prisma });
    expect(out).toMatchObject({ ok: false, reason: "deal_not_found" });
  });
});

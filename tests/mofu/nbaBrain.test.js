import { describe, it, expect, vi } from "vitest";
import { deriveCandidates, computeNba } from "@/lib/mofu/nbaBrain";

const bundle = {
  actionable_recommendations: [
    { action_type: "SEND_EMAIL", title: "Pricing follow-up", signal_reference_id: "s1", rationale: "pricing" },
    { action_type: "INVENT_SOMETHING", title: "bogus" }, // dropped — not in closed set
    { action_type: "PREP_MEETING", title: "Prep QBR", signal_reference_id: "s2" },
  ],
};

describe("nbaBrain (US-4.1)", () => {
  it("deriveCandidates keeps only closed-set action types", () => {
    const c = deriveCandidates(bundle);
    expect(c.map((x) => x.action_type)).toEqual(["SEND_EMAIL", "PREP_MEETING"]);
  });

  it("persists ranked NbaRecommendation rows citing signal refs", async () => {
    const created = [];
    const prisma = {
      nbaRecommendation: {
        create: vi.fn(async (a) => {
          created.push(a.data);
          return { id: `rec_${created.length}`, ...a.data };
        }),
      },
    };
    // jury ranks PREP_MEETING (index 1) above SEND_EMAIL (index 0)
    const jury = vi.fn(async () => ({
      result: { ranking: [{ index: 1, score: 0.9 }, { index: 0, score: 0.4 }] },
      juryResult: { reconciliation: { mode: "higher_confidence" } },
      modelUsed: "openai:gpt-4o+anthropic:claude-sonnet-4-6",
      providerUsage: {},
      providerCost: {},
    }));
    const out = await computeNba(
      { tenantId: "t1", dealId: "deal_1", bundle, signals: [{ signalReferenceId: "s1", kind: "EMAIL", score: 1 }] },
      { prisma, jury }
    );
    expect(out.recommendations).toHaveLength(2);
    expect(created[0].actionType).toBe("PREP_MEETING"); // top-ranked first
    expect(created[0].score).toBe(0.9);
    expect(created[1].actionType).toBe("SEND_EMAIL");
    expect(created[0].status).toBe("SUGGESTED");
  });

  it("falls back deterministically if the jury fails (deal never blank)", async () => {
    const created = [];
    const prisma = {
      nbaRecommendation: { create: vi.fn(async (a) => { created.push(a.data); return { id: "r", ...a.data }; }) },
    };
    const jury = vi.fn(async () => { throw new Error("both_down"); });
    const out = await computeNba({ tenantId: "t1", dealId: "deal_1", bundle, signals: [] }, { prisma, jury });
    expect(out.recommendations.length).toBe(2); // both candidates persisted in order
    expect(created[0].juryResult.reconciliation.mode).toBe("jury_unavailable");
  });
});

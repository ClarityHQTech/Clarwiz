import { describe, it, expect, vi } from "vitest";
import { computeInsightBundle } from "@/lib/mofu/insightBundle";

const FAKE_BUNDLE = {
  executive_intelligence_summary: { summary: "Acme is evaluating us for Q3." },
  heptapod_dimensional_analysis: {
    stakeholder: { summary: "2 champions identified" },
    value: { summary: "ROI ~3x" },
    risk: { summary: "Budget approval pending" },
    temporal: { summary: "Decision by Q3" },
    competitive: { summary: "Competing with X" },
    expansion: { summary: "Upsell to EU team" },
  },
  actionable_recommendations: [
    { action_type: "SEND_EMAIL", title: "Follow up on pricing", signal_reference_id: "hubspot:CALL_TRANSCRIPT:c1", rationale: "asked about pricing" },
  ],
  system_metadata: { confidence: 0.7, data_completeness: 0.5 },
};

function deps({ accepted = true } = {}) {
  const created = [];
  const prisma = {
    dealInsight: {
      create: vi.fn(async (a) => {
        created.push(a.data);
        return { id: "insight_1", ...a.data };
      }),
    },
  };
  const generate = vi.fn(async () => ({
    data: FAKE_BUNDLE,
    model: "gpt-4o",
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    cost: { total_cost_usd: 0.001 },
  }));
  const jury = vi.fn(async () => ({
    result: { approved: accepted, confidence: 0.8 },
    juryResult: { reconciliation: { mode: "agreement" } },
  }));
  return { prisma, generate, jury, created };
}

describe("computeInsightBundle (US-3.1)", () => {
  it("maps the six dimensions + recs + metadata into DealInsight", async () => {
    const d = deps();
    const out = await computeInsightBundle(
      { tenantId: "t1", scope: "DEAL", dealId: "deal_1", context: {}, signals: [] },
      { prisma: d.prisma, generate: d.generate, jury: d.jury }
    );
    expect(out.insightId).toBe("insight_1");
    const saved = d.created[0];
    expect(saved.stakeholderIntelligence.summary).toBe("2 champions identified");
    expect(saved.valueIntelligence).toBeTruthy();
    expect(saved.riskIntelligence).toBeTruthy();
    expect(saved.temporalIntelligence).toBeTruthy();
    expect(saved.competitiveIntelligence).toBeTruthy();
    expect(saved.expansionIntelligence).toBeTruthy();
    expect(saved.actionableRecommendations).toHaveLength(1);
    expect(saved.systemMetadata.acceptance.approved).toBe(true);
  });

  it("still persists when the acceptance jury throws (degrade, no crash)", async () => {
    const d = deps();
    d.jury = vi.fn(async () => {
      throw new Error("both_down");
    });
    const out = await computeInsightBundle(
      { tenantId: "t1", scope: "DEAL", dealId: "deal_1", context: {}, signals: [] },
      { prisma: d.prisma, generate: d.generate, jury: d.jury }
    );
    expect(out.insightId).toBe("insight_1");
    expect(d.created[0].systemMetadata.jury.mode).toBe("jury_unavailable");
  });
});

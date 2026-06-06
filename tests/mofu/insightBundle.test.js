import { describe, it, expect, vi } from "vitest";
import { computeInsightBundle, deriveConfidence } from "@/lib/mofu/insightBundle";

const FAKE_BUNDLE = {
  executive_intelligence_summary: {
    account_status_vector: { company_name: "Acme", health_score: "7/10", risk_level: "medium", momentum_direction: "accelerating", opportunity_value: "$84k" },
    primary_recommendation: "Address the data-residency blocker before the eval.",
    critical_actions_required: [{ priority: "high", action: "Send residency proof", owner: "AE", deadline: "this week" }],
    intelligence_confidence: { level: "high", supporting_factors: ["warm reply"] },
  },
  heptapod_dimensional_analysis: {
    stakeholder_intelligence: { individual_profiles: [{ name: "Dana", role_type: "champion", influence_level: "high", engagement_status: "active" }] },
    value_intelligence: { realized_value: { economic_value: { direct_roi: "4.1x" } } },
    risk_intelligence: { risk_assessment: [{ severity_level: "high", description: "EU residency", probability: 70 }] },
    temporal_intelligence: { future_projections: { decision_timelines: [{ decision_type: "close", estimated_date: "Q3" }] } },
    competitive_intelligence: { position_assessment: { feature_differentiation: [{ capability: "residency", our_strength: "superior" }] } },
    expansion_intelligence: { growth_vectors: [{ vector_type: "EU subsidiary", value_potential: "$55k" }] },
  },
  actionable_recommendations: {
    immediate_actions: [{ action: "Follow up on pricing", title: "Follow up on pricing", action_type: "SEND_EMAIL", priority_score: 92, signal_reference_id: "hubspot:CALL_TRANSCRIPT:c1" }],
    short_term_initiatives: [],
    long_term_positioning: [],
  },
  system_metadata: { data_completeness: 0.6 },
};

function deps() {
  const created = [];
  const prisma = { dealInsight: { create: vi.fn(async (a) => { created.push(a.data); return { id: "insight_1", ...a.data }; }) } };
  const generate = vi.fn(async () => ({ data: FAKE_BUNDLE, model: "gpt-4o", usage: {}, cost: { total_cost_usd: 0.001 } }));
  const jury = vi.fn(async () => ({ result: { approved: true, confidence: 0.8 }, juryResult: { reconciliation: { mode: "agreement" } } }));
  return { prisma, generate, jury, created };
}

describe("computeInsightBundle (US-3.1, Aura shape)", () => {
  it("maps Aura's nested dimensions into DealInsight", async () => {
    const d = deps();
    const out = await computeInsightBundle({ tenantId: "t1", scope: "DEAL", dealId: "deal_1", context: {}, signals: [] }, { prisma: d.prisma, generate: d.generate, jury: d.jury });
    expect(out.insightId).toBe("insight_1");
    const saved = d.created[0];
    expect(saved.stakeholderIntelligence.individual_profiles[0].name).toBe("Dana");
    expect(saved.valueIntelligence.realized_value.economic_value.direct_roi).toBe("4.1x");
    expect(saved.riskIntelligence.risk_assessment[0].severity_level).toBe("high");
    expect(saved.actionableRecommendations.immediate_actions[0].action_type).toBe("SEND_EMAIL");
    expect(saved.systemMetadata.confidence).toBe(0.85); // from intelligence_confidence.level=high
  });

  it("deriveConfidence falls back to data_completeness when no level", () => {
    expect(deriveConfidence({ system_metadata: { data_completeness: 0.5 } })).toBe(0.5);
  });
});

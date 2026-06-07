import { describe, it, expect } from "vitest";
import { toDealViewModel } from "./dealViewModel";

// A full AURA-style payload exercising every branch.
const fullView = {
  deal: {
    id: "deal_1",
    hubspotDealId: "hs_99",
    name: "Acme Expansion",
    stageLabel: "Negotiation",
    amount: 48000.5,
    status: "OPEN",
    score: 72,
    lastActivityAt: new Date("2026-05-01T10:00:00Z"),
  },
  account: { id: "acc_1", name: "Acme Co" },
  company: { id: "co_1", name: "Acme Co", domain: "acme.com" },
  contacts: [
    { id: "c1", email: "a@acme.com", businessUser: { name: "Ann Buyer", title: "VP" } },
    { id: "c2", email: "b@acme.com", businessUser: null },
  ],
  insight: {
    id: "ins_1",
    computedAt: new Date("2026-05-02T10:00:00Z"),
    payload: {
      account_level_briefing: "Acme is expanding their data platform.",
      account_score: 81,
      brief_summary: "Strong intent, budget confirmed.",
      your_coach_speaks: "Lead with ROI.",
      aura_insight_detected: {
        insight_label: "Budget unlocked",
        insight_explanation: "Finance approved Q3 spend.",
        gtm_paths_you_can_pursue: [
          {
            title: "Run technical validation",
            score_impact: 12,
            path_steps: ["Book POC kickoff", "Share security docs"],
            why_this_works: "Removes the last technical blocker.",
          },
          {
            title: "Executive alignment",
            score_impact: 8,
            path_steps: ["Schedule exec sync"],
            why_this_works: "Builds sponsor confidence.",
          },
        ],
      },
      recommended_next_best_actions: {
        ae: ["Send recap email"],
        system: ["Update forecast"],
        marketing: ["Add to nurture"],
        cs: ["Prep onboarding"],
      },
      likelihood_to_progress: "High",
      follow_up_effort: "Low",
      positive_outcomes_observed: [{ outcome: "Champion engaged" }, { outcome: "Demo attended" }],
      early_warning_signal: [{ warning_signal: "No legal contact yet" }],
      coaching_tip: "Confirm the decision timeline.",
    },
  },
  nbas: [
    {
      id: "nba_1",
      title: "Draft recap email",
      actionType: "draft_email",
      actionVerb: "Sales::Negotiate",
      score: 90,
      rationale: "Keep momentum.",
      status: "SUGGESTED",
      payload: {},
      draftPayload: null,
    },
  ],
  signals: [
    {
      id: "sig_1",
      type: "intent",
      category: "engagement",
      score: 70,
      confidence: 0.8,
      headline: "Pricing page visited",
      evidence: "3 views this week",
      suggestedAngle: "Offer a tailored quote",
      tier: "hot",
    },
  ],
};

describe("toDealViewModel", () => {
  it("normalizes a full payload into a flat, structured view model", () => {
    const vm = toDealViewModel(fullView);

    expect(vm.deal.id).toBe("deal_1");
    expect(vm.deal.hubspotDealId).toBe("hs_99");
    expect(vm.deal.name).toBe("Acme Expansion");
    expect(vm.deal.amount).toBe(48000.5);
    expect(vm.deal.stageLabel).toBe("Negotiation");

    expect(vm.hasInsight).toBe(true);
    expect(vm.accountScore).toBe(81);
    expect(vm.briefing.accountLevelBriefing).toContain("data platform");
    expect(vm.briefing.briefSummary).toContain("budget");
    expect(vm.briefing.coachSpeaks).toBe("Lead with ROI.");

    expect(vm.insightDetected.label).toBe("Budget unlocked");
    expect(vm.gtmPaths).toHaveLength(2);
    expect(vm.gtmPaths[0].title).toBe("Run technical validation");
    expect(vm.gtmPaths[0].scoreImpact).toBe(12);
    expect(vm.gtmPaths[0].steps).toEqual(["Book POC kickoff", "Share security docs"]);

    expect(vm.likelihoodToProgress).toBe("High");
    expect(vm.followUpEffort).toBe("Low");
    expect(vm.positiveOutcomes).toEqual(["Champion engaged", "Demo attended"]);
    expect(vm.earlyWarnings).toEqual(["No legal contact yet"]);
    expect(vm.coachingTip).toBe("Confirm the decision timeline.");

    expect(vm.recommendedActions.ae).toEqual(["Send recap email"]);

    expect(vm.contacts).toHaveLength(2);
    expect(vm.contacts[0].name).toBe("Ann Buyer");
    expect(vm.contacts[1].name).toBe("b@acme.com"); // falls back to email when no businessUser

    expect(vm.nbas).toHaveLength(1);
    expect(vm.signals).toHaveLength(1);
    expect(vm.company.name).toBe("Acme Co");
  });

  it("is null-safe for a near-empty view (insight null, missing nested fields)", () => {
    const vm = toDealViewModel({
      deal: { id: "d", hubspotDealId: "h", name: "Bare Deal" },
      account: null,
      company: null,
      contacts: [],
      insight: null,
      nbas: [],
      signals: [],
    });

    expect(vm.hasInsight).toBe(false);
    expect(vm.accountScore).toBeNull();
    expect(vm.briefing.accountLevelBriefing).toBeNull();
    expect(vm.insightDetected.label).toBeNull();
    expect(vm.gtmPaths).toEqual([]);
    expect(vm.positiveOutcomes).toEqual([]);
    expect(vm.earlyWarnings).toEqual([]);
    expect(vm.coachingTip).toBeNull();
    expect(vm.recommendedActions).toEqual({ ae: [], system: [], marketing: [], cs: [] });
    expect(vm.contacts).toEqual([]);
    expect(vm.nbas).toEqual([]);
    expect(vm.signals).toEqual([]);
    expect(vm.deal.name).toBe("Bare Deal");
    expect(vm.deal.amount).toBeNull();
  });

  it("handles a totally empty/garbage view without throwing", () => {
    const vm = toDealViewModel(null);
    expect(vm.hasInsight).toBe(false);
    expect(vm.deal).toBeNull();
    expect(vm.gtmPaths).toEqual([]);
  });

  it("tolerates a partial insight payload (some nested objects missing)", () => {
    const vm = toDealViewModel({
      deal: { id: "d", hubspotDealId: "h", name: "Partial" },
      insight: {
        payload: {
          brief_summary: "Just a summary.",
          aura_insight_detected: { insight_label: "Lone label" },
          early_warning_signal: [{ warning_signal: "risk" }, { nope: "x" }],
        },
      },
    });
    expect(vm.hasInsight).toBe(true);
    expect(vm.briefing.briefSummary).toBe("Just a summary.");
    expect(vm.insightDetected.label).toBe("Lone label");
    expect(vm.insightDetected.explanation).toBeNull();
    expect(vm.gtmPaths).toEqual([]);
    expect(vm.earlyWarnings).toEqual(["risk"]); // filters the malformed entry
    expect(vm.accountScore).toBeNull();
  });
});

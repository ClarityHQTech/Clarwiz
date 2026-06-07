import { describe, it, expect } from "vitest";
import { rankCollateral, topSuggestions } from "./collateralRank";

const base = (over = {}) => ({
  id: "c1",
  title: "Item",
  type: "ONE_PAGER",
  source: "GENERATED",
  funnelStage: "ANY",
  tags: [],
  companyHsId: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  ...over,
});

describe("rankCollateral", () => {
  it("returns [] for an empty list", () => {
    expect(rankCollateral([], { funnelStage: "DEAL_EARLY" })).toEqual([]);
  });

  it("scores +2 for an exact funnelStage match", () => {
    const items = [base({ id: "a", funnelStage: "DEAL_EARLY" })];
    const [r] = rankCollateral(items, { funnelStage: "DEAL_EARLY" });
    expect(r.score).toBe(2);
    expect(r.reasons.some((x) => /stage/i.test(x))).toBe(true);
  });

  it("scores +1 for an ANY-stage fallback when stage differs", () => {
    const items = [base({ id: "a", funnelStage: "ANY" })];
    const [r] = rankCollateral(items, { funnelStage: "DEAL_LATE" });
    expect(r.score).toBe(1);
  });

  it("ranks an early-deal item above a late-deal item for an early-deal ctx", () => {
    const items = [
      base({ id: "late", funnelStage: "DEAL_LATE" }),
      base({ id: "early", funnelStage: "DEAL_EARLY" }),
    ];
    const ranked = rankCollateral(items, { funnelStage: "DEAL_EARLY" });
    expect(ranked[0].id).toBe("early");
  });

  it("ranks an exact company match first (+3) above a stage-only match", () => {
    const items = [
      base({ id: "stage", funnelStage: "DEAL_EARLY", companyHsId: "999" }),
      base({ id: "company", funnelStage: "ANY", companyHsId: "42" }),
    ];
    const ranked = rankCollateral(items, {
      funnelStage: "DEAL_EARLY",
      companyHsId: "42",
    });
    expect(ranked[0].id).toBe("company");
    expect(ranked[0].score).toBeGreaterThanOrEqual(3);
    expect(ranked[0].reasons.some((x) => /company/i.test(x))).toBe(true);
  });

  it("adds +1 per tag intersecting industry/persona, case-insensitively", () => {
    const items = [
      base({ id: "a", tags: ["FinTech", "CFO", "unrelated"] }),
    ];
    const [r] = rankCollateral(items, {
      funnelStage: "LEAD",
      industry: "fintech",
      persona: "cfo",
    });
    // funnelStage LEAD vs ANY -> +1, two tag hits -> +2 => 3
    expect(r.score).toBe(3);
  });

  it("scores +1 for a matching category (MARKETING|SALES)", () => {
    const items = [base({ id: "a", funnelStage: "ANY", category: "SALES" })];
    const [r] = rankCollateral(items, { funnelStage: "DEAL_LATE", category: "SALES" });
    // ANY-stage +1, category +1 => 2
    expect(r.score).toBe(2);
    expect(r.reasons.some((x) => /SALES/i.test(x))).toBe(true);
  });

  it("does not award category when it differs (case-insensitive match only)", () => {
    const items = [base({ id: "a", funnelStage: "ANY", category: "MARKETING" })];
    const [r] = rankCollateral(items, { funnelStage: "DEAL_LATE", category: "sales" });
    expect(r.score).toBe(1); // ANY-stage only
  });

  it("scores +2 for a matching type and ranks it first", () => {
    const items = [
      base({ id: "onepager", funnelStage: "ANY", type: "ONE_PAGER" }),
      base({ id: "roi", funnelStage: "ANY", type: "CASE_STUDY" }),
    ];
    const ranked = rankCollateral(items, { funnelStage: "DEAL_LATE", type: "CASE_STUDY" });
    expect(ranked[0].id).toBe("roi");
    expect(ranked[0].score).toBe(3); // ANY +1, type +2
  });

  it("combines company + stage + type + category + tags", () => {
    const items = [
      base({
        id: "best",
        funnelStage: "DEAL_LATE",
        companyHsId: "42",
        category: "SALES",
        type: "BATTLECARD",
        tags: ["fintech"],
      }),
    ];
    const [r] = rankCollateral(items, {
      funnelStage: "DEAL_LATE",
      companyHsId: "42",
      category: "SALES",
      type: "BATTLECARD",
      industry: "fintech",
    });
    // +3 company, +2 stage, +2 type, +1 category, +1 tag = 9
    expect(r.score).toBe(9);
  });

  it("tie-breaks on newest createdAt", () => {
    const items = [
      base({ id: "old", funnelStage: "ANY", createdAt: new Date("2023-01-01Z") }),
      base({ id: "new", funnelStage: "ANY", createdAt: new Date("2025-01-01Z") }),
    ];
    const ranked = rankCollateral(items, { funnelStage: "DEAL_LATE" });
    expect(ranked[0].id).toBe("new");
  });

  it("handles a missing/partial ctx without throwing", () => {
    const items = [base({ id: "a" })];
    expect(() => rankCollateral(items, {})).not.toThrow();
    expect(() => rankCollateral(items)).not.toThrow();
  });
});

describe("topSuggestions", () => {
  it("returns at most n results, scored & sorted", () => {
    const items = [
      base({ id: "a", funnelStage: "DEAL_EARLY", companyHsId: "42" }),
      base({ id: "b", funnelStage: "DEAL_EARLY" }),
      base({ id: "c", funnelStage: "ANY" }),
      base({ id: "d", funnelStage: "DEAL_LATE" }),
    ];
    const top = topSuggestions(items, { funnelStage: "DEAL_EARLY", companyHsId: "42" }, 2);
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe("a");
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
  });

  it("defaults to 3 suggestions", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      base({ id: `i${i}`, funnelStage: "ANY" })
    );
    expect(topSuggestions(items, { funnelStage: "LEAD" })).toHaveLength(3);
  });
});

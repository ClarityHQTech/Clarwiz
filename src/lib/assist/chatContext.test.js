import { describe, it, expect } from "vitest";
import { buildSnapshot, buildChatSystemPrompt, buildDealCockpitSystemPrompt } from "./chatContext";

describe("buildSnapshot", () => {
  it("returns a null-shaped snapshot for a null/undefined view", () => {
    expect(buildSnapshot(null)).toEqual({ kind: "empty" });
    expect(buildSnapshot(undefined)).toEqual({ kind: "empty" });
  });

  it("passes through cockpit_deal snapshots unchanged", () => {
    const snap = { kind: "cockpit_deal", deal: { id: "d1" } };
    expect(buildSnapshot(snap)).toBe(snap);
  });
});

describe("buildDealCockpitSystemPrompt", () => {
  it("locks the assistant to the open deal and embeds context", () => {
    const snapshot = {
      kind: "cockpit_deal",
      scope: { dealId: "d1", dealName: "Acme Expansion" },
      deal: { id: "d1", name: "Acme Expansion" },
      company: { name: "Acme Corp" },
    };
    const prompt = buildDealCockpitSystemPrompt({
      pageContext: { entityType: "deal", id: "d1", name: "Acme Expansion" },
      snapshot,
    });
    expect(prompt).toMatch(/Cockpit/i);
    expect(prompt).toMatch(/locked to deal id "d1"/i);
    expect(prompt).toMatch(/another deal/i);
    expect(prompt).toContain("Acme Expansion");
    expect(prompt).toContain('"kind":"cockpit_deal"');
  });
});

describe("buildChatSystemPrompt", () => {
  it("uses deal cockpit prompt for deal entity type", () => {
    const prompt = buildChatSystemPrompt({
      pageContext: { entityType: "deal", id: "d1", name: "Acme" },
      snapshot: { kind: "cockpit_deal", scope: { dealId: "d1" }, deal: { name: "Acme" } },
    });
    expect(prompt).toMatch(/locked to deal id "d1"/i);
  });

  it("handles empty snapshot without throwing", () => {
    const prompt = buildChatSystemPrompt({ pageContext: undefined, snapshot: { kind: "empty" } });
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { buildSnapshot, buildChatSystemPrompt } from "./chatContext";

describe("buildSnapshot", () => {
  it("returns a null-shaped snapshot for a null/undefined view", () => {
    expect(buildSnapshot(null)).toEqual({ kind: "empty" });
    expect(buildSnapshot(undefined)).toEqual({ kind: "empty" });
  });

  it("compacts a deal view to ids/name/stage/score + top signals & nbas", () => {
    const view = {
      deal: {
        id: "d1",
        hubspotDealId: "hd1",
        name: "Acme Expansion",
        stageLabel: "Negotiation",
        amount: 50000,
        status: "OPEN",
        score: 72,
      },
      account: { id: "a1", hubspotCompanyId: "hc1" },
      company: { id: "c1", name: "Acme Corp", domain: "acme.com", industry: "SaaS" },
      contacts: [
        { id: "ct1", name: "Jane Buyer", jobTitle: "VP Eng" },
        { id: "ct2", name: "Bob Tech" },
      ],
      insight: { score: 72, summary: "Strong momentum, budget confirmed." },
      nbas: Array.from({ length: 8 }).map((_, i) => ({
        id: `n${i}`,
        title: `NBA ${i}`,
        actionType: "draft_email",
        score: 90 - i,
        status: "SUGGESTED",
      })),
      signals: Array.from({ length: 9 }).map((_, i) => ({
        id: `s${i}`,
        headline: `Signal ${i}`,
        type: "Behavior::X",
        category: "Behavior",
        score: 80 - i,
      })),
    };
    const snap = buildSnapshot(view);
    expect(snap.kind).toBe("deal");
    expect(snap.deal).toMatchObject({ id: "d1", name: "Acme Expansion", stage: "Negotiation", score: 72 });
    expect(snap.company).toMatchObject({ name: "Acme Corp" });
    // bounded: top N only
    expect(snap.topSignals.length).toBeLessThanOrEqual(5);
    expect(snap.topNbas.length).toBeLessThanOrEqual(5);
    // each signal/nba is compact (no raw payload)
    expect(snap.topSignals[0]).not.toHaveProperty("payload");
    expect(snap.topNbas[0]).not.toHaveProperty("payload");
    // does not embed full deal payload
    expect(JSON.stringify(snap)).not.toMatch(/"payload"/);
  });

  it("compacts a company view to account/company + top signals + open deals", () => {
    const view = {
      account: { id: "a1", hubspotCompanyId: "hc1", lifecycleStage: "customer" },
      company: { id: "c1", name: "Globex", domain: "globex.com", industry: "Mfg" },
      insight: { payload: { huge: "x".repeat(5000) } },
      signals: [{ id: "s1", headline: "Champion left", score: 90, category: "Risk" }],
      deals: [
        { id: "d1", name: "Globex Renewal", stageLabel: "Closed Won", amount: 10000, status: "WON" },
      ],
      contacts: [{ id: "ct1", name: "Pat" }],
    };
    const snap = buildSnapshot(view);
    expect(snap.kind).toBe("company");
    expect(snap.company).toMatchObject({ name: "Globex" });
    expect(snap.deals.length).toBe(1);
    expect(snap.topSignals[0]).toMatchObject({ headline: "Champion left" });
    // huge insight payload must not leak in
    expect(JSON.stringify(snap)).not.toMatch(/xxxxxxxxxx/);
  });

  it("compacts a dashboard view to pipeline counts + top deals", () => {
    const view = {
      deals: Array.from({ length: 12 }).map((_, i) => ({
        id: `d${i}`,
        name: `Deal ${i}`,
        stageLabel: "Stage",
        amount: 1000 * i,
        status: "OPEN",
        score: 50 + i,
      })),
      leads: [{ id: "l1" }, { id: "l2" }],
      accounts: [{ id: "a1" }],
    };
    const snap = buildSnapshot(view);
    expect(snap.kind).toBe("dashboard");
    expect(snap.pipeline).toMatchObject({ openDeals: 12, leads: 2, accounts: 1 });
    expect(snap.topDeals.length).toBeLessThanOrEqual(8);
  });
});

describe("buildChatSystemPrompt", () => {
  it("grounds the assistant as a GTM AE copilot and includes the entity name", () => {
    const snapshot = buildSnapshot({
      deal: { id: "d1", name: "Acme Expansion", stageLabel: "Negotiation", score: 72 },
      company: { id: "c1", name: "Acme Corp" },
      nbas: [],
      signals: [],
    });
    const prompt = buildChatSystemPrompt({
      pageContext: { entityType: "deal", id: "d1", name: "Acme Expansion" },
      snapshot,
    });
    expect(prompt).toMatch(/AE|account executive|copilot/i);
    expect(prompt).toContain("Acme Expansion");
    // embeds the snapshot JSON
    expect(prompt).toContain("d1");
    expect(prompt).toContain('"kind"');
  });

  it("handles a null/empty view and missing page context without throwing", () => {
    const snapshot = buildSnapshot(null);
    const prompt = buildChatSystemPrompt({ pageContext: undefined, snapshot });
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('"empty"');
  });

  it("stays bounded even with a large view", () => {
    const view = {
      deal: { id: "d1", name: "Big Deal", stageLabel: "S", score: 1 },
      company: { id: "c1", name: "Co" },
      signals: Array.from({ length: 50 }).map((_, i) => ({
        id: `s${i}`,
        headline: "H".repeat(500),
        score: i,
      })),
      nbas: Array.from({ length: 50 }).map((_, i) => ({ id: `n${i}`, title: "T".repeat(500), score: i })),
    };
    const prompt = buildChatSystemPrompt({
      pageContext: { entityType: "deal", name: "Big Deal" },
      snapshot: buildSnapshot(view),
    });
    expect(prompt.length).toBeLessThan(8000);
  });
});

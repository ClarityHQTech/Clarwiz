import { describe, it, expect } from "vitest";
import {
  formatAmount,
  stageColor,
  formatStaleness,
  latestSyncedAt,
  latestSyncedAtFromDeals,
  buildDashboardView,
  buildDealsPageView,
} from "./dashboardView";

describe("formatAmount", () => {
  it("formats whole dollars with no cents", () => {
    expect(formatAmount(1500)).toBe("$1,500");
    expect(formatAmount(0)).toBe("$0");
    expect(formatAmount(1234567)).toBe("$1,234,567");
  });
  it("rounds fractional amounts", () => {
    expect(formatAmount(99.6)).toBe("$100");
  });
  it("returns a dash for null/undefined/NaN", () => {
    expect(formatAmount(null)).toBe("—");
    expect(formatAmount(undefined)).toBe("—");
    expect(formatAmount("abc")).toBe("—");
  });
});

describe("stageColor", () => {
  it("maps known bands", () => {
    expect(stageColor("DEAL_EARLY")).toBe("blue");
    expect(stageColor("DEAL_LATE")).toBe("purple");
  });
  it("falls back to gray for unknown/null", () => {
    expect(stageColor(null)).toBe("gray");
    expect(stageColor("WEIRD")).toBe("gray");
  });
});

describe("latestSyncedAt", () => {
  it("returns the newest syncedAt across accounts", () => {
    const accounts = [
      { syncedAt: new Date("2026-01-01T00:00:00Z") },
      { syncedAt: new Date("2026-03-01T00:00:00Z") },
      { syncedAt: new Date("2026-02-01T00:00:00Z") },
    ];
    expect(latestSyncedAt(accounts)).toEqual(new Date("2026-03-01T00:00:00Z"));
  });
  it("returns null for empty or syncless accounts", () => {
    expect(latestSyncedAt([])).toBeNull();
    expect(latestSyncedAt([{ syncedAt: null }])).toBeNull();
    expect(latestSyncedAt(undefined)).toBeNull();
  });
});

describe("formatStaleness", () => {
  const now = new Date("2026-06-08T12:00:00Z");
  it("says 'just now' under a minute", () => {
    expect(formatStaleness(new Date("2026-06-08T11:59:40Z"), now)).toBe("just now");
  });
  it("formats minutes/hours/days", () => {
    expect(formatStaleness(new Date("2026-06-08T11:30:00Z"), now)).toBe("30m ago");
    expect(formatStaleness(new Date("2026-06-08T09:00:00Z"), now)).toBe("3h ago");
    expect(formatStaleness(new Date("2026-06-05T12:00:00Z"), now)).toBe("3d ago");
  });
  it("handles never-synced", () => {
    expect(formatStaleness(null, now)).toBe("never synced");
  });
});

describe("buildDashboardView", () => {
  const data = {
    deals: [
      { id: "d1", status: "OPEN", name: "Acme", lastActivityAt: new Date("2026-06-01") },
      { id: "d2", status: "OPEN", name: "Beta", lastActivityAt: new Date("2026-06-05") },
    ],
    leads: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
    accounts: [
      { id: "a1", _count: { deals: 2 }, syncedAt: new Date("2026-06-07") },
      { id: "a2", _count: { deals: 0 }, syncedAt: new Date("2026-06-06") },
    ],
  };

  it("returns counts and the latest sync timestamp", () => {
    const v = buildDashboardView(data);
    expect(v.counts).toEqual({ deals: 2, leads: 3, accounts: 2 });
    expect(v.latestSyncedAt).toEqual(new Date("2026-06-07"));
    expect(v.isEmpty).toBe(false);
  });

  it("flags an empty graph when nothing is hydrated", () => {
    const v = buildDashboardView({ deals: [], leads: [], accounts: [] });
    expect(v.isEmpty).toBe(true);
    expect(v.counts).toEqual({ deals: 0, leads: 0, accounts: 0 });
    expect(v.latestSyncedAt).toBeNull();
  });

  it("tolerates missing arrays", () => {
    const v = buildDashboardView({});
    expect(v.isEmpty).toBe(true);
    expect(v.counts).toEqual({ deals: 0, leads: 0, accounts: 0 });
  });
});

describe("buildDealsPageView", () => {
  const data = {
    deals: [
      {
        id: "d1",
        name: "Acme expansion",
        stageLabel: "Negotiation",
        amount: 120000,
        score: 72,
        lastActivityAt: new Date("2026-06-01"),
        syncedAt: new Date("2026-06-07"),
        account: { company: { name: "Acme Corp" } },
        _count: { dealContacts: 3, nbas: 2 },
      },
      {
        id: "d2",
        name: "Beta pilot",
        stageLabel: "Discovery",
        amount: null,
        score: null,
        lastActivityAt: new Date("2026-06-05"),
        syncedAt: new Date("2026-06-08"),
        account: null,
        _count: { dealContacts: 0, nbas: 0 },
      },
    ],
  };

  it("shapes deal rows with company, contacts, score, and executed NBAs", () => {
    const v = buildDealsPageView(data);
    expect(v.count).toBe(2);
    expect(v.isEmpty).toBe(false);
    expect(v.latestSyncedAt).toEqual(new Date("2026-06-08"));
    expect(v.deals[0]).toEqual({
      id: "d1",
      name: "Acme expansion",
      company: "Acme Corp",
      stageLabel: "Negotiation",
      amount: 120000,
      score: 72,
      contactCount: 3,
      executedNbaCount: 2,
      lastActivityAt: new Date("2026-06-01"),
    });
    expect(v.deals[1].company).toBeNull();
    expect(v.deals[1].executedNbaCount).toBe(0);
  });

  it("flags an empty list when no deals are hydrated", () => {
    const v = buildDealsPageView({ deals: [] });
    expect(v.isEmpty).toBe(true);
    expect(v.count).toBe(0);
    expect(v.latestSyncedAt).toBeNull();
  });
});

describe("latestSyncedAtFromDeals", () => {
  it("returns the newest syncedAt across deals", () => {
    const deals = [
      { syncedAt: new Date("2026-01-01T00:00:00Z") },
      { syncedAt: new Date("2026-03-01T00:00:00Z") },
    ];
    expect(latestSyncedAtFromDeals(deals)).toEqual(new Date("2026-03-01T00:00:00Z"));
  });
});

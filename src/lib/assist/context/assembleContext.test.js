import { describe, it, expect, vi } from "vitest";

// Mock the reader so we control the view-model returned to the assembler.
vi.mock("@/lib/assist/insightsReader", () => ({
  getDealView: vi.fn(),
  getCompanyView: vi.fn(),
  getLatestCompanyInsight: vi.fn(),
}));

import { assembleDealContext, assembleCompanyContext } from "./assembleContext.js";
import { getDealView, getCompanyView, getLatestCompanyInsight } from "@/lib/assist/insightsReader";
import { ONTOLOGY } from "@/lib/assist/prompts/ontology.js";

// HubSpot fetch stub keyed by deal id → associations + batch-read for emails.
function makeHsFetch(byDeal) {
  return vi.fn(async (url, opts) => {
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    // associations: /deals/<id>/associations/<type>
    const assocMatch = url.match(/\/deals\/([^/]+)\/associations\/(\w+)/);
    if (assocMatch) {
      const [, dealId, type] = assocMatch;
      const cfg = byDeal[dealId] ?? {};
      return json({ results: cfg[type] ?? [] });
    }
    // batch read: /objects/<type>/batch/read
    const batchMatch = url.match(/\/objects\/(\w+)\/batch\/read/);
    if (batchMatch) {
      const [, type] = batchMatch;
      // find which deal these ids belong to via the request body inputs
      let inputs = [];
      try {
        inputs = JSON.parse(opts?.body ?? "{}").inputs ?? [];
      } catch {
        inputs = [];
      }
      const ids = inputs.map((i) => i.id);
      for (const cfg of Object.values(byDeal)) {
        if (type === "emails" && cfg.emailProps) {
          const results = cfg.emailProps.filter((r) => ids.includes(r.id));
          if (results.length) return json({ results });
        }
      }
      return json({ results: [] });
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

function makePrisma(tenant, commLogs = []) {
  return {
    tenant: { findUnique: vi.fn(async () => tenant) },
    communicationLog: { findMany: vi.fn(async () => commLogs) },
  };
}

describe("assembleDealContext", () => {
  it("returns the full vars shape from the deal view + tenant + engagements", async () => {
    getDealView.mockResolvedValue({
      deal: { id: "d1", name: "Acme Deal", ownerId: "own1", payload: { hs_object_id: "555" } },
      account: { id: "a1", payload: { name: "Acme" } },
      company: { name: "Acme Inc", payload: { industry: "SaaS" } },
      contacts: [{ id: "c1", payload: { email: "x@acme.com" } }],
      insight: { payload: { account_score: "70" } },
      signals: [{ type: "Behavior::Response_Time_Decay", score: 80, payload: { a: 1 } }],
      nbas: [],
    });
    const prisma = makePrisma(
      { id: "t1", name: "SellerCo", company_details: { team: ["AE Jane"] } },
      [{ id: "e1", channel: "email", message: "hi", subject: "s" }]
    );

    const vars = await assembleDealContext(prisma, "t1", "d1");

    expect(vars.ontology).toBe(ONTOLOGY);
    expect(vars.companyData).toBeTruthy();
    expect(vars.contactData).toEqual([{ id: "c1", payload: { email: "x@acme.com" } }]);
    expect(vars.dealData).toMatchObject({ id: "d1", name: "Acme Deal" });
    expect(vars.tenantData).toMatchObject({ name: "SellerCo" });
    expect(vars.ownerData).toBeDefined();
    expect(Array.isArray(vars.engagements)).toBe(true);
    expect(vars.engagements.length).toBe(1);
    expect(Array.isArray(vars.signals)).toBe(true);
    expect(vars.previousInsights).toBeTruthy();
    // carries the resolved deal/account ids for the orchestrator
    expect(vars._dealId).toBe("d1");
    expect(vars._accountId).toBe("a1");
    expect(vars._hsObjectId).toBe("555");
  });

  it("merges injected HubSpot engagements (token+fetch) ahead of commlog rows", async () => {
    getDealView.mockResolvedValue({
      deal: { id: "d1", name: "Acme Deal", hubspotDealId: "HD1", payload: { hs_object_id: "555" } },
      account: { id: "a1" },
      company: null,
      contacts: [],
      insight: null,
      signals: [],
    });
    const prisma = makePrisma({ id: "t1", name: "SellerCo" }, [
      { id: "e1", channel: "email", message: "commlog row" },
    ]);

    const fetchImpl = makeHsFetch({
      HD1: {
        emails: [{ toObjectId: "E1" }],
        meetings: [],
        notes: [],
        calls: [],
        emailProps: [{ id: "E1", properties: { hs_email_subject: "HS email", hs_email_text: "from hubspot", hs_timestamp: "2026-02-01T00:00:00Z" } }],
      },
    });

    const vars = await assembleDealContext(prisma, "t1", "d1", { token: "tok", fetchImpl });
    expect(vars.engagements.length).toBe(2);
    // HubSpot items first, then commlog rows
    expect(vars.engagements[0]).toMatchObject({ type: "email", source: "hubspot", text: "from hubspot" });
    expect(vars.engagements[1]).toMatchObject({ id: "e1" });
  });

  it("aggregates HubSpot engagements across the account's deals (company context)", async () => {
    getCompanyView.mockResolvedValue({
      account: { id: "a9", ownerId: "own9" },
      company: { name: "Globex" },
      insight: null,
      signals: [],
      deals: [
        { id: "d9", hubspotDealId: "HD9" },
        { id: "d10", hubspotDealId: "HD10" },
      ],
      contacts: [],
    });
    const prisma = makePrisma({ id: "t1", name: "SellerCo" }, []);
    const fetchImpl = makeHsFetch({
      HD9: { emails: [{ toObjectId: "E9" }], meetings: [], notes: [], calls: [], emailProps: [{ id: "E9", properties: { hs_email_text: "deal9 email", hs_timestamp: "2026-02-02T00:00:00Z" } }] },
      HD10: { emails: [{ toObjectId: "E10" }], meetings: [], notes: [], calls: [], emailProps: [{ id: "E10", properties: { hs_email_text: "deal10 email", hs_timestamp: "2026-02-03T00:00:00Z" } }] },
    });

    const vars = await assembleCompanyContext(prisma, "t1", "a9", { token: "tok", fetchImpl });
    const texts = vars.engagements.map((e) => e.text);
    expect(texts).toContain("deal9 email");
    expect(texts).toContain("deal10 email");
  });

  it("is null-safe when the deal view is missing", async () => {
    getDealView.mockResolvedValue(null);
    const prisma = makePrisma(null, []);
    const vars = await assembleDealContext(prisma, "t1", "missing");
    expect(vars).toBeNull();
  });

  it("survives a tenant/commlog read failure (resilient)", async () => {
    getDealView.mockResolvedValue({
      deal: { id: "d2" },
      account: null,
      company: null,
      contacts: [],
      insight: null,
      signals: [],
    });
    const prisma = {
      tenant: { findUnique: vi.fn(async () => { throw new Error("db down"); }) },
      communicationLog: { findMany: vi.fn(async () => { throw new Error("db down"); }) },
    };
    const vars = await assembleDealContext(prisma, "t1", "d2");
    expect(vars).not.toBeNull();
    expect(vars.engagements).toEqual([]);
    expect(vars.tenantData).toBeNull();
  });
});

describe("assembleCompanyContext", () => {
  it("returns vars from the company view + tenant", async () => {
    getCompanyView.mockResolvedValue({
      account: { id: "a9", ownerId: "own9", payload: { name: "Globex" } },
      company: { name: "Globex", payload: {} },
      insight: { payload: { account_score: "60" } },
      signals: [],
      deals: [{ id: "d9", name: "Globex Deal" }],
      contacts: [{ id: "c9" }],
    });
    const prisma = makePrisma({ id: "t1", name: "SellerCo" }, []);

    const vars = await assembleCompanyContext(prisma, "t1", "a9");
    expect(vars.ontology).toBe(ONTOLOGY);
    expect(vars._accountId).toBe("a9");
    expect(vars.dealData).toBeDefined();
    expect(vars.contactData.length).toBe(1);
    expect(vars.tenantData).toMatchObject({ name: "SellerCo" });
  });

  it("is null-safe when the company view is missing", async () => {
    getCompanyView.mockResolvedValue(null);
    const prisma = makePrisma(null, []);
    expect(await assembleCompanyContext(prisma, "t1", "x")).toBeNull();
  });
});

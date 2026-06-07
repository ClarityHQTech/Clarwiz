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

import { describe, it, expect } from "vitest";
import { getTenantInternalDomains, normalizeDomain } from "./internalDomains.js";

describe("normalizeDomain", () => {
  it("lowercases and trims", () => {
    expect(normalizeDomain("  ClarityHQ.AI ")).toBe("clarityhq.ai");
  });

  it("strips a leading @", () => {
    expect(normalizeDomain("@clarityhq.ai")).toBe("clarityhq.ai");
  });

  it("strips a leading www.", () => {
    expect(normalizeDomain("www.clarityhq.ai")).toBe("clarityhq.ai");
  });

  it("strips a scheme + path if a URL is pasted", () => {
    expect(normalizeDomain("https://www.clarityhq.ai/about")).toBe("clarityhq.ai");
  });

  it("returns null for empty / non-domain input", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain("notadomain")).toBeNull();
  });
});

// Minimal fake prisma exposing only tenantMembership.findMany + tenant.findUnique.
function fakePrisma({ memberEmails = [], companyDetails = null } = {}) {
  return {
    tenantMembership: {
      findMany: async () => memberEmails.map((email) => ({ user: { email } })),
    },
    tenant: {
      findUnique: async () => ({ company_details: companyDetails }),
    },
  };
}

describe("getTenantInternalDomains", () => {
  it("returns member-derived business domains (free-mail excluded)", async () => {
    const prisma = fakePrisma({
      memberEmails: ["ae@acme.com", "rep@acme.com", "personal@gmail.com"],
    });
    const out = await getTenantInternalDomains(prisma, "t1");
    expect(out).toEqual(["acme.com"]);
  });

  it("merges configured domains with member-derived ones and dedups", async () => {
    const prisma = fakePrisma({
      memberEmails: ["ae@acme.com"],
      companyDetails: { internalDomains: ["clarityhq.ai", "acme.com"] },
    });
    const out = await getTenantInternalDomains(prisma, "t1");
    expect(out.sort()).toEqual(["acme.com", "clarityhq.ai"]);
  });

  it("keeps a configured free-mail-looking domain (opted in explicitly) even though members can't add it", async () => {
    const prisma = fakePrisma({
      memberEmails: ["ae@gmail.com"], // free-mail member => NOT internal
      companyDetails: { internalDomains: ["@Gmail.com"] }, // configured verbatim => kept
    });
    const out = await getTenantInternalDomains(prisma, "t1");
    expect(out).toEqual(["gmail.com"]);
  });

  it("normalizes configured entries (strips @ / www., lowercases)", async () => {
    const prisma = fakePrisma({
      memberEmails: [],
      companyDetails: { internalDomains: ["@ClarityHQ.AI", "www.Other.IO", "  "] },
    });
    const out = await getTenantInternalDomains(prisma, "t1");
    expect(out.sort()).toEqual(["clarityhq.ai", "other.io"]);
  });

  it("tolerates a missing / malformed company_details.internalDomains", async () => {
    const prisma = fakePrisma({
      memberEmails: ["ae@acme.com"],
      companyDetails: { internalDomains: "not-an-array" },
    });
    const out = await getTenantInternalDomains(prisma, "t1");
    expect(out).toEqual(["acme.com"]);
  });

  it("returns [] when there are no members and no configured domains", async () => {
    const prisma = fakePrisma({ memberEmails: [], companyDetails: null });
    expect(await getTenantInternalDomains(prisma, "t1")).toEqual([]);
  });
});

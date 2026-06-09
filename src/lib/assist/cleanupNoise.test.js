import { describe, it, expect } from "vitest";
import { selectNoiseAccounts } from "./cleanupNoise.js";

// Account shape the selector expects (as the route will project it):
//   { id, name, hubspotCompanyId, dealCount, contactCount, company: { domain } }
function acct(over = {}) {
  return {
    id: "a",
    name: "Acme",
    hubspotCompanyId: "hs-1",
    dealCount: 0,
    contactCount: 0,
    company: { domain: null },
    ...over,
  };
}

describe("selectNoiseAccounts", () => {
  const internal = ["acme.com", "clarityhq.ai"];

  it("selects a 0-deal account whose company.domain is internal", () => {
    const a = acct({ id: "i1", company: { domain: "clarityhq.ai" } });
    expect(selectNoiseAccounts([a], internal)).toEqual(["i1"]);
  });

  it("does NOT select an internal-domain account that has a deal", () => {
    const a = acct({ id: "i2", dealCount: 2, company: { domain: "clarityhq.ai" } });
    expect(selectNoiseAccounts([a], internal)).toEqual([]);
  });

  it("selects a domain-synthetic orphan (0 deals, 0 linked contacts)", () => {
    const a = acct({
      id: "s1",
      hubspotCompanyId: "domain:ghost.io",
      dealCount: 0,
      contactCount: 0,
      company: { domain: "ghost.io" },
    });
    expect(selectNoiseAccounts([a], internal)).toEqual(["s1"]);
  });

  it("does NOT select a domain-synthetic account that still has a linked contact", () => {
    const a = acct({
      id: "s2",
      hubspotCompanyId: "domain:realLead.io",
      dealCount: 0,
      contactCount: 1,
      company: { domain: "reallead.io" },
    });
    expect(selectNoiseAccounts([a], internal)).toEqual([]);
  });

  it("does NOT select a real (non-synthetic) lead company with a contact and a non-internal domain", () => {
    const a = acct({
      id: "r1",
      hubspotCompanyId: "hs-999",
      dealCount: 0,
      contactCount: 3,
      company: { domain: "reallead.io" },
    });
    expect(selectNoiseAccounts([a], internal)).toEqual([]);
  });

  it("NEVER selects an account with >=1 deal, even a synthetic orphan", () => {
    const a = acct({
      id: "d1",
      hubspotCompanyId: "domain:hasdeal.io",
      dealCount: 1,
      contactCount: 0,
      company: { domain: "hasdeal.io" },
    });
    expect(selectNoiseAccounts([a], internal)).toEqual([]);
  });

  it("matches internal domains case-insensitively", () => {
    const a = acct({ id: "i3", company: { domain: "ClarityHQ.ai" } });
    expect(selectNoiseAccounts([a], ["clarityhq.ai"])).toEqual(["i3"]);
  });

  it("does NOT select a real synced account with a real HubSpot id and no domain match", () => {
    const a = acct({ id: "ok", hubspotCompanyId: "hs-42", company: { domain: "prospect.com" } });
    expect(selectNoiseAccounts([a], internal)).toEqual([]);
  });

  it("handles a synthetic account with a missing company gracefully (orphan => selected)", () => {
    const a = acct({ id: "s3", hubspotCompanyId: "domain:x.io", company: null, contactCount: 0 });
    expect(selectNoiseAccounts([a], internal)).toEqual(["s3"]);
  });

  it("returns only the noise ids from a mixed batch", () => {
    const accounts = [
      acct({ id: "keep-deal", dealCount: 1, company: { domain: "clarityhq.ai" } }),
      acct({ id: "drop-internal", company: { domain: "acme.com" } }),
      acct({ id: "drop-orphan", hubspotCompanyId: "domain:ghost.io", company: { domain: "ghost.io" } }),
      acct({ id: "keep-real", hubspotCompanyId: "hs-7", contactCount: 2, company: { domain: "prospect.com" } }),
    ];
    expect(selectNoiseAccounts(accounts, internal).sort()).toEqual(["drop-internal", "drop-orphan"]);
  });

  it("returns [] for empty input", () => {
    expect(selectNoiseAccounts([], internal)).toEqual([]);
    expect(selectNoiseAccounts([acct()], [])).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  generateCollateral,
  assembleCollateralVars,
  fillCollateralUser,
  parseCollateralJson,
  COLLATERAL_SYSTEM,
  COLLATERAL_USER,
  COLLATERAL_PROMPT_VERSION,
} from "./collateralGen.js";

const FENCED = `\`\`\`json
{
  "title": "Acme x Clarwiz — Security One-Pager",
  "data": { "headline": "De-risk your rollout", "missing_fields": [] },
  "template": "<div className=\\"p-8\\">Hello</div>",
  "compilance": { "score": "88", "note": "On-brand; no invented facts." }
}
\`\`\``;

/** A fake Anthropic client that records the request and returns fenced JSON. */
function fakeClient(text = FENCED) {
  const seen = [];
  return {
    seen,
    messages: { create: async (req) => (seen.push(req), { content: [{ type: "text", text }] }) },
  };
}

describe("fillCollateralUser", () => {
  it("substitutes tenant/prospect/nba and blanks playbookData", () => {
    const out = fillCollateralUser(COLLATERAL_USER, {
      tenantData: { name: "Clarwiz" },
      prospectData: { company: { name: "Acme" } },
      nbaData: { title: "Send ROI deck" },
    });
    expect(out).toContain('{"name":"Clarwiz"}');
    expect(out).toContain('{"company":{"name":"Acme"}}');
    expect(out).toContain('{"title":"Send ROI deck"}');
    // playbookData placeholder is filled with empty string, not left as {{...}}
    expect(out).not.toContain("{{playbookData}}");
    expect(out).not.toContain("{{tenantData}}");
  });
});

describe("parseCollateralJson", () => {
  it("strips fences, normalizes misspelled compilance → compliance", () => {
    const parsed = parseCollateralJson(FENCED);
    expect(parsed.title).toContain("Acme");
    expect(parsed.template).toContain("Hello");
    expect(parsed.data.headline).toBe("De-risk your rollout");
    expect(parsed.compliance).toEqual({ score: "88", note: "On-brand; no invented facts." });
  });

  it("parses raw (unfenced) JSON embedded in prose", () => {
    const parsed = parseCollateralJson(
      'Here you go:\n{"title":"T","data":{},"template":"x","compilance":{"score":"50","note":"ok"}}',
    );
    expect(parsed.title).toBe("T");
    expect(parsed.compliance.score).toBe("50");
  });

  it("throws on non-JSON output", () => {
    expect(() => parseCollateralJson("no json here")).toThrow();
  });
});

describe("generateCollateral", () => {
  it("calls Claude correctly, returns the parsed shape", async () => {
    const client = fakeClient();
    const res = await generateCollateral({
      client,
      vars: { tenantData: { name: "Clarwiz" }, prospectData: null, nbaData: null },
    });

    expect(res.title).toContain("Acme");
    expect(res.template).toContain("Hello");
    expect(res.compliance).toEqual({ score: "88", note: "On-brand; no invented facts." });
    expect(res.model).toBe("claude-opus-4-8");
    expect(res.promptVersion).toBe(COLLATERAL_PROMPT_VERSION);

    const req = client.seen[0];
    expect(req.model).toBe("claude-opus-4-8");
    // adaptive thinking IS sent
    expect(req.thinking).toEqual({ type: "adaptive" });
    // NO temperature/top_p/top_k (400 on Opus 4.8)
    expect(req).not.toHaveProperty("temperature");
    expect(req).not.toHaveProperty("top_p");
    expect(req).not.toHaveProperty("top_k");
    // system + a single user message
    expect(req.system).toBe(COLLATERAL_SYSTEM);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe("user");
    expect(req.messages[0].content).toContain('{"name":"Clarwiz"}');
  });

  it("respects an injected system override", async () => {
    const client = fakeClient();
    await generateCollateral({ client, system: "OVERRIDE", vars: {} });
    expect(client.seen[0].system).toBe("OVERRIDE");
  });
});

describe("assembleCollateralVars", () => {
  function fakePrisma({ tenant, deal, nba, account }) {
    return {
      tenant: { findUnique: async () => tenant ?? null },
      deal: { findFirst: async () => deal ?? null },
      account: { findFirst: async () => account ?? null },
      nbaRecommendation: { findFirst: async () => nba ?? null },
    };
  }

  it("builds vars from a deal (account+company) and an nba", async () => {
    const prisma = fakePrisma({
      tenant: { id: "t1", name: "Clarwiz", company_details: { product: "AI GTM" } },
      deal: {
        id: "D1",
        name: "Acme Expansion",
        stageLabel: "Proposal",
        hubspotDealId: "HSD1",
        account: {
          id: "A1",
          hubspotCompanyId: "HSC1",
          lifecycleStage: "opportunity",
          company: { name: "Acme" },
          payload: { industry: "fintech" },
        },
      },
      nba: {
        id: "N1",
        title: "Send ROI deck",
        actionType: "send_collateral",
        actionVerb: "Sales::Justify",
        rationale: "CFO wants ROI",
        payload: { asset: "one-pager" },
        deal: null,
      },
    });

    const { vars, dealHsId, companyHsId } = await assembleCollateralVars(prisma, "t1", {
      dealId: "D1",
      nbaId: "N1",
    });

    expect(vars.tenantData).toEqual({ name: "Clarwiz", company_details: { product: "AI GTM" } });
    expect(vars.prospectData.company).toEqual({ name: "Acme" });
    expect(vars.prospectData.hubspotCompanyId).toBe("HSC1");
    expect(vars.nbaData.title).toBe("Send ROI deck");
    expect(vars.nbaData.payload).toEqual({ asset: "one-pager" });
    expect(dealHsId).toBe("HSD1");
    expect(companyHsId).toBe("HSC1");
  });

  it("resolves the account directly via accountId when no deal", async () => {
    const prisma = fakePrisma({
      tenant: { id: "t1", name: "Clarwiz", company_details: null },
      account: {
        id: "A2",
        hubspotCompanyId: "HSC2",
        company: { name: "Beta" },
        payload: null,
      },
    });
    const { vars, companyHsId, dealHsId } = await assembleCollateralVars(prisma, "t1", {
      accountId: "A2",
    });
    expect(vars.prospectData.company).toEqual({ name: "Beta" });
    expect(companyHsId).toBe("HSC2");
    expect(dealHsId).toBeNull();
    expect(vars.nbaData).toBeNull();
  });

  it("falls back to the nba's deal account when no dealId given", async () => {
    const prisma = fakePrisma({
      tenant: { id: "t1", name: "Clarwiz", company_details: null },
      nba: {
        id: "N3",
        title: "Follow up",
        actionType: "draft_email",
        payload: null,
        deal: {
          id: "D3",
          name: "Gamma deal",
          hubspotDealId: "HSD3",
          account: { id: "A3", hubspotCompanyId: "HSC3", company: { name: "Gamma" }, payload: null },
        },
      },
    });
    const { vars, dealHsId, companyHsId } = await assembleCollateralVars(prisma, "t1", {
      nbaId: "N3",
    });
    expect(vars.prospectData.company).toEqual({ name: "Gamma" });
    expect(dealHsId).toBe("HSD3");
    expect(companyHsId).toBe("HSC3");
  });
});

describe("prompt constants", () => {
  it("carry the expected verbatim anchors and placeholders", () => {
    expect(COLLATERAL_SYSTEM).toContain("You are Tailspin");
    expect(COLLATERAL_USER).toContain("{{tenantData}}");
    expect(COLLATERAL_USER).toContain("{{prospectData}}");
    expect(COLLATERAL_USER).toContain("{{nbaData}}");
    expect(COLLATERAL_USER).toContain("{{playbookData}}");
    // The output contract keeps the misspelled key as the model emits it.
    expect(COLLATERAL_USER).toContain("compilance");
  });
});

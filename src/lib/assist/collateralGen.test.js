import { describe, it, expect } from "vitest";
import {
  generateCollateral,
  editCollateral,
  templateToHtml,
  assembleCollateralVars,
  fillCollateralUser,
  parseCollateralJson,
  COLLATERAL_SYSTEM,
  COLLATERAL_USER,
  COLLATERAL_EDIT_SYSTEM,
  COLLATERAL_PROMPT_VERSION,
  COLLATERAL_DOC_TOOL,
} from "./collateralGen.js";

/** A doc-model object the way the structured-output tool returns it. */
const DOC = {
  title: "Acme x Clarwiz — Security One-Pager",
  assetType: "one_pager",
  headline: "De-risk your rollout",
  subhead: "Built for Acme's security team",
  audience: "CISO",
  sections: [{ id: "problem", title: "The problem", body: "Manual reviews are **slow**." }],
  metrics: [{ label: "18-mo TCO", value: "$420k", detail: "vs incumbent" }],
  cta: { label: "Book a 30-min ROI review", detail: "with your AE" },
  compliance: { score: "88", note: "On-brand; no invented facts." },
};

/**
 * A fake Anthropic client that records the request and returns the doc model in
 * a `tool_use` block (the structured-output path). Pass a plain object to
 * override the returned doc.
 */
function fakeClient(doc = DOC) {
  const seen = [];
  return {
    seen,
    messages: {
      create: async (req) => (
        seen.push(req),
        {
          content: [{ type: "tool_use", name: COLLATERAL_DOC_TOOL.name, input: doc }],
        }
      ),
    },
  };
}

/** A fake client that returns the doc as JSON text instead of a tool_use block. */
function fakeTextClient(doc = DOC, wrap = (s) => s) {
  const seen = [];
  return {
    seen,
    messages: {
      create: async (req) => (
        seen.push(req),
        { content: [{ type: "text", text: wrap(JSON.stringify(doc)) }] }
      ),
    },
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
    expect(out).not.toContain("{{playbookData}}");
    expect(out).not.toContain("{{tenantData}}");
  });
});

describe("parseCollateralJson (doc model)", () => {
  it("normalizes a doc model and renders styled html from it", () => {
    const parsed = parseCollateralJson(JSON.stringify(DOC));
    expect(parsed.title).toContain("Acme");
    expect(parsed.data.headline).toBe("De-risk your rollout");
    expect(parsed.data.assetType).toBe("one_pager");
    // html is DETERMINISTICALLY rendered from the doc, not trusted from the model.
    expect(parsed.html).toContain("<!DOCTYPE html>");
    expect(parsed.html).toContain("De-risk your rollout");
    expect(parsed.html).toContain("18-mo TCO");
    expect(parsed.html).not.toContain("<script");
    // template stores the doc model (JSON) for future react-live.
    expect(parsed.template).toContain("De-risk your rollout");
    expect(parsed.compliance).toEqual({ score: "88", note: "On-brand; no invented facts." });
  });

  it("normalizes the misspelled compilance key", () => {
    const { compliance, ...rest } = DOC;
    const parsed = parseCollateralJson(JSON.stringify({ ...rest, compilance: { score: "50", note: "ok" } }));
    expect(parsed.compliance).toEqual({ score: "50", note: "ok" });
  });

  it("strips ```json fences and parses prose-wrapped JSON", () => {
    const parsed = parseCollateralJson("Here:\n```json\n" + JSON.stringify(DOC) + "\n```");
    expect(parsed.title).toContain("Acme");
    expect(parsed.html).toContain("<!DOCTYPE html>");
  });

  it("throws on non-JSON output", () => {
    expect(() => parseCollateralJson("no json here")).toThrow();
  });
});

describe("generateCollateral", () => {
  it("returns the doc model as data + deterministic html, with forced tool output and NO sampling/thinking params", async () => {
    const client = fakeClient();
    const res = await generateCollateral({
      client,
      vars: { tenantData: { name: "Clarwiz" }, prospectData: null, nbaData: null },
    });

    expect(res.title).toContain("Acme");
    expect(res.data.headline).toBe("De-risk your rollout");
    expect(res.html).toContain("<!DOCTYPE html>");
    expect(res.html).toContain("De-risk your rollout");
    expect(res.compliance).toEqual({ score: "88", note: "On-brand; no invented facts." });
    expect(res.model).toBe("claude-opus-4-8");
    expect(res.promptVersion).toBe(COLLATERAL_PROMPT_VERSION);

    const req = client.seen[0];
    expect(req.model).toBe("claude-opus-4-8");
    expect(req).not.toHaveProperty("thinking"); // forced tool_choice forbids thinking on Opus 4.8
    expect(req).not.toHaveProperty("temperature");
    expect(req).not.toHaveProperty("top_p");
    expect(req).not.toHaveProperty("top_k");
    // structured output: a tool with one property per doc field + forced tool_choice.
    expect(Array.isArray(req.tools)).toBe(true);
    expect(req.tools[0].name).toBe(COLLATERAL_DOC_TOOL.name);
    expect(req.tools[0].input_schema.properties).toHaveProperty("headline");
    expect(req.tools[0].input_schema.properties).toHaveProperty("sections");
    expect(req.tool_choice).toEqual({ type: "tool", name: COLLATERAL_DOC_TOOL.name });
    expect(req.system).toBe(COLLATERAL_SYSTEM);
    expect(req.messages[0].content).toContain('{"name":"Clarwiz"}');
  });

  it("falls back to parsing JSON text when the model returns text instead of a tool_use", async () => {
    const client = fakeTextClient();
    const res = await generateCollateral({ client, vars: {} });
    expect(res.data.headline).toBe("De-risk your rollout");
    expect(res.html).toContain("<!DOCTYPE html>");
  });

  it("respects an injected system override", async () => {
    const client = fakeClient();
    await generateCollateral({ client, system: "OVERRIDE", vars: {} });
    expect(client.seen[0].system).toBe("OVERRIDE");
  });
});

describe("editCollateral (doc model)", () => {
  const EDITED = {
    ...DOC,
    headline: "Edited headline",
    compliance: { score: "90", note: "Tightened per instruction." },
  };

  it("patches the doc model, re-renders html, and forces the tool, NO sampling/thinking params", async () => {
    const client = fakeClient(EDITED);
    const res = await editCollateral({
      client,
      currentDoc: DOC,
      instruction: "Change the headline",
    });

    expect(res.data.headline).toBe("Edited headline");
    expect(res.html).toContain("<!DOCTYPE html>");
    expect(res.html).toContain("Edited headline");
    expect(res.compliance).toEqual({ score: "90", note: "Tightened per instruction." });

    const req = client.seen[0];
    expect(req.model).toBe("claude-opus-4-8");
    expect(req).not.toHaveProperty("thinking"); // forced tool_choice forbids thinking on Opus 4.8
    expect(req).not.toHaveProperty("temperature");
    expect(req).not.toHaveProperty("top_p");
    expect(req).not.toHaveProperty("top_k");
    expect(req.system).toBe(COLLATERAL_EDIT_SYSTEM);
    expect(req.tool_choice).toEqual({ type: "tool", name: COLLATERAL_DOC_TOOL.name });
    // The user message carries both the instruction and the current doc JSON.
    const content = req.messages[0].content;
    expect(content).toContain("Change the headline");
    expect(content).toContain("De-risk your rollout");
  });

  it("accepts a currentDoc passed as a JSON string", async () => {
    const client = fakeClient(EDITED);
    const res = await editCollateral({
      client,
      currentDoc: JSON.stringify(DOC),
      instruction: "x",
    });
    expect(res.data.headline).toBe("Edited headline");
  });
});

describe("templateToHtml (legacy fallback)", () => {
  it("wraps a JSX/markup template in a self-contained HTML document", () => {
    const html = templateToHtml('<div className="p-8">Hi there</div>');
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Hi there");
    expect(html).toContain('class="p-8"');
    expect(html).not.toContain("className");
  });

  it("returns a safe placeholder doc for empty input", () => {
    const html = templateToHtml("");
    expect(html).toContain("<!doctype html>");
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
      account: { id: "A2", hubspotCompanyId: "HSC2", company: { name: "Beta" }, payload: null },
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
  });
});

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
  getTenantBrand,
  DEFAULT_BRAND,
  assembleProspectContext,
  personalizeTemplate,
  COLLATERAL_PERSONALIZE_SYSTEM,
  COLLATERAL_PERSONALIZE_VERSION,
  sanitizeSalesCollateralDoc,
  stripBracketPlaceholders,
  summarizeAvailableFacts,
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

describe("getTenantBrand", () => {
  it("reads company_details.brand", () => {
    const brand = getTenantBrand({
      company_details: {
        brand: { primary: "#111111", accent: "#0EA5E9", logoUrl: "https://x/y.png", tagline: "Go fast" },
      },
    });
    expect(brand.primary).toBe("#111111");
    expect(brand.accent).toBe("#0EA5E9");
    expect(brand.logoUrl).toBe("https://x/y.png");
    expect(brand.tagline).toBe("Go fast");
  });

  it("falls back to amber defaults when brand is missing/partial", () => {
    expect(getTenantBrand(null).accent).toBe(DEFAULT_BRAND.accent);
    expect(getTenantBrand({ company_details: {} }).accent).toBe(DEFAULT_BRAND.accent);
    const partial = getTenantBrand({ company_details: { brand: { accent: "  " } } });
    expect(partial.accent).toBe(DEFAULT_BRAND.accent); // blank string → default
    expect(partial.fontBody).toBe(DEFAULT_BRAND.fontBody);
  });
});

describe("assembleProspectContext", () => {
  function fakePrisma(opts) {
    const { tenant, deal, nba, account, dealContacts, companyInsight, dealInsight, signals } = opts;
    return {
      tenant: { findUnique: async () => tenant ?? null },
      deal: { findFirst: async () => deal ?? null },
      account: { findFirst: async () => account ?? null },
      nbaRecommendation: { findFirst: async () => nba ?? null },
      dealContact: { findMany: async () => dealContacts ?? [] },
      companyInsight: { findFirst: async () => companyInsight ?? null },
      dealInsight: { findFirst: async () => dealInsight ?? null },
      signal: { findMany: async () => signals ?? [] },
    };
  }

  it("assembles a rich context: brand, seller, prospect, contacts, deal, insights, signals, assetBrief", async () => {
    const prisma = fakePrisma({
      tenant: {
        id: "t1",
        name: "Clarwiz",
        company_details: { product: "AI GTM", brand: { accent: "#0EA5E9", logoUrl: "https://c/l.png" } },
      },
      deal: {
        id: "D1",
        name: "Acme Expansion",
        stageLabel: "Proposal",
        amount: 42000,
        status: "OPEN",
        hubspotDealId: "HSD1",
        account: {
          id: "A1",
          hubspotCompanyId: "HSC1",
          lifecycleStage: "opportunity",
          payload: { initiative: "consolidation" },
          company: { name: "Acme", domain: "acme.com", industry: "fintech" },
        },
      },
      nba: {
        id: "N1",
        title: "Send ROI one-pager",
        actionType: "send_collateral",
        actionVerb: "Sales::Justify",
        rationale: "CFO wants ROI",
        payload: {
          asset: "ROI one-pager for the CFO",
          resource_requirements: { email_detail: { theme: "ROI", content: ["payback under 6mo"] } },
        },
        deal: null,
      },
      dealContacts: [
        {
          role: "Champion",
          contact: {
            persona: "CHAMPION",
            businessUser: { name: "Dana Lee", jobTitle: "CFO", email: "dana@acme.com" },
          },
        },
      ],
      companyInsight: { payload: { headline: "Scaling fast" }, computedAt: new Date("2026-01-01Z") },
      dealInsight: { briefing: "Late-stage, CFO-led", summary: "Strong", score: 80 },
      signals: [{ type: "Behavior::Engaged", category: "Behavior", headline: "Opened deck 3x", score: 90, suggestedAngle: "Strike now" }],
    });

    const ctx = await assembleProspectContext(prisma, "t1", { dealId: "D1", nbaId: "N1" });

    expect(ctx.brand.accent).toBe("#0EA5E9");
    expect(ctx.brand.logoUrl).toBe("https://c/l.png");
    expect(ctx.seller.name).toBe("Clarwiz");
    expect(ctx.prospect.name).toBe("Acme");
    expect(ctx.prospect.domain).toBe("acme.com");
    expect(ctx.prospect.website).toBe("https://acme.com");
    expect(ctx.prospect.industry).toBe("fintech");
    expect(ctx.contacts).toHaveLength(1);
    expect(ctx.contacts[0]).toMatchObject({ name: "Dana Lee", title: "CFO", email: "dana@acme.com", role: "Champion" });
    expect(ctx.deal).toMatchObject({ name: "Acme Expansion", stage: "Proposal", amount: 42000 });
    expect(ctx.insights.company.summary).toEqual({ headline: "Scaling fast" });
    expect(ctx.insights.deal.briefing).toBe("Late-stage, CFO-led");
    expect(ctx.signals[0].headline).toBe("Opened deck 3x");
    expect(ctx.assetBrief.asset).toBe("ROI one-pager for the CFO");
    expect(ctx.assetBrief.emailDetail.theme).toBe("ROI");
    expect(ctx.dealHsId).toBe("HSD1");
    expect(ctx.companyHsId).toBe("HSC1");
  });

  it("resolves an account directly via accountId (no deal/nba)", async () => {
    const prisma = fakePrisma({
      tenant: { id: "t1", name: "Clarwiz", company_details: null },
      account: { id: "A2", hubspotCompanyId: "HSC2", company: { name: "Beta", domain: "beta.io", industry: "saas" } },
    });
    const ctx = await assembleProspectContext(prisma, "t1", { accountId: "A2" });
    expect(ctx.prospect.name).toBe("Beta");
    expect(ctx.prospect.website).toBe("https://beta.io");
    expect(ctx.deal).toBeNull();
    expect(ctx.assetBrief).toBeNull();
    expect(ctx.contacts).toEqual([]);
    expect(ctx.brand.accent).toBe(DEFAULT_BRAND.accent);
  });
});

describe("personalizeTemplate", () => {
  const TEMPLATE = {
    title: "Generic ROI One-Pager",
    html: "<!DOCTYPE html><html>base</html>",
    data: {
      title: "Generic ROI One-Pager",
      assetType: "one_pager",
      headline: "Cut costs with [Product]",
      sections: [{ id: "value", title: "Value", body: "Save money." }],
      compliance: { score: "70", note: "generic" },
    },
  };

  const PERSONALIZED = {
    ...TEMPLATE.data,
    headline: "Cut Acme's costs",
    sections: [{ id: "value", title: "Value", body: "Save Acme money on consolidation." }],
    compliance: { score: "92", note: "Grounded in Acme context." },
  };

  const CONTEXT = {
    brand: { accent: "#0EA5E9", primary: "#111", fontHeading: "Georgia", fontBody: "Inter" },
    seller: { name: "Clarwiz" },
    prospect: { name: "Acme", industry: "fintech" },
    contacts: [{ name: "Dana Lee", title: "CFO" }],
    deal: { name: "Acme Expansion", stage: "Proposal" },
  };

  it("rewrites only the content, keeps brand, forces the tool, NO sampling/thinking params", async () => {
    const client = fakeClient(PERSONALIZED);
    const res = await personalizeTemplate({ client, templateDoc: TEMPLATE, context: CONTEXT });

    expect(res.data.headline).toBe("Cut Acme's costs");
    expect(res.data.assetType).toBe("one_pager"); // structure preserved
    expect(res.html).toContain("<!DOCTYPE html>");
    expect(res.html).toContain("Cut Acme"); // headline rendered (apostrophe is html-escaped)
    // re-rendered with the tenant brand accent (#0EA5E9), not the default amber.
    expect(res.html).toContain("#0EA5E9");
    expect(res.compliance).toEqual({ score: "92", note: "Grounded in Acme context." });
    expect(res.model).toBe("claude-opus-4-8");
    expect(res.promptVersion).toBe(COLLATERAL_PERSONALIZE_VERSION);

    const req = client.seen[0];
    expect(req.model).toBe("claude-opus-4-8");
    expect(req).not.toHaveProperty("thinking");
    expect(req).not.toHaveProperty("temperature");
    expect(req).not.toHaveProperty("top_p");
    expect(req).not.toHaveProperty("top_k");
    expect(req.system).toBe(COLLATERAL_PERSONALIZE_SYSTEM);
    expect(req.tool_choice).toEqual({ type: "tool", name: COLLATERAL_DOC_TOOL.name });
    // The user message carries BOTH the template and the prospect context.
    const content = req.messages[0].content;
    expect(content).toContain("Cut costs with [Product]"); // the template
    expect(content).toContain("AVAILABLE FACTS");
    expect(content).toContain("Acme"); // the prospect context
    expect(content).toContain("Dana Lee");
    expect(content).toContain("prospect-facing sales collateral");
  });

  it("includes an extra instruction when provided", async () => {
    const client = fakeClient(PERSONALIZED);
    await personalizeTemplate({ client, templateDoc: TEMPLATE, context: CONTEXT, instruction: "Lead with payback." });
    expect(client.seen[0].messages[0].content).toContain("Lead with payback.");
  });
});

describe("sanitizeSalesCollateralDoc", () => {
  const CONTEXT = {
    seller: { name: "Clarwiz" },
    prospect: { name: "Acme", industry: "fintech" },
  };

  it("strips bracket placeholders and drops empty metrics", () => {
    const out = sanitizeSalesCollateralDoc(
      {
        assetType: "one_pager",
        headline: "How Clarwiz helps [ProspectCompany]",
        subhead: "[Unknown subhead]",
        sections: [
          { id: "a", title: "Real section", body: "Acme needs faster close." },
          { id: "b", title: "[Empty]", body: "- [Benefit1]\n- Still real" },
        ],
        metrics: [
          { label: "ROI", value: "[ROI%]", detail: "unknown" },
          { label: "Stage", value: "Proposal", detail: "current deal" },
        ],
        cta: { label: "Book a call", detail: "[ChampionName]" },
      },
      CONTEXT,
    );

    expect(out.headline).toBe("How Clarwiz helps");
    expect(out.subhead).toBeUndefined();
    expect(out.sections).toHaveLength(2);
    expect(out.sections[1].body).not.toContain("[");
    expect(out.metrics).toHaveLength(1);
    expect(out.metrics[0].value).toBe("Proposal");
    expect(out.cta.label).toBe("Book a call");
    expect(out.cta.detail).toBeUndefined();
  });

  it("falls back headline from seller + prospect when template headline is empty", () => {
    const out = sanitizeSalesCollateralDoc(
      { assetType: "one_pager", headline: "[ProspectCompany] overview" },
      CONTEXT,
    );
    expect(out.headline).toBe("overview");
  });
});

describe("stripBracketPlaceholders", () => {
  it("removes bracket tokens and tidies spacing", () => {
    expect(stripBracketPlaceholders("For [ProspectCompany] in [Industry]")).toBe("For in");
    expect(stripBracketPlaceholders("Payback in [PaybackMonths] mo")).toBe("Payback in mo");
  });
});

describe("summarizeAvailableFacts", () => {
  it("lists grounded facts from prospect context", () => {
    const summary = summarizeAvailableFacts({
      seller: { name: "Clarwiz", company_details: { product: "AI GTM" } },
      prospect: { name: "Acme", industry: "fintech" },
      contacts: [{ name: "Dana", title: "CFO" }],
      deal: { name: "Expansion", stage: "Proposal" },
      signals: [{ headline: "Opened deck" }],
    });
    expect(summary).toContain("Clarwiz");
    expect(summary).toContain("Acme");
    expect(summary).toContain("Dana");
    expect(summary).toContain("Opened deck");
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

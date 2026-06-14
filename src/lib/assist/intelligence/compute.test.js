import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  toInt,
  categoryOf,
  deriveActionType,
  buildSignalData,
  buildNbaData,
  buildDealInsightData,
  bootstrapSignalsFromTofuCampaign,
  bootstrapSignalsFromEngagements,
  shrinkPromptVars,
  recomputeDeal,
  recomputeCompany,
  resolveDealAccountIds,
  formatRecomputeSummary,
} from "./compute.js";
import { extractSignalsPayload } from "./runner.js";
import { PROMPT_VERSION } from "@/lib/assist/prompts/ontology.js";

// ---------------------------------------------------------------------------
// pure normalization helpers
// ---------------------------------------------------------------------------
describe("toInt", () => {
  it("parses ints, fractions, slashes, percents, plus-signs", () => {
    expect(toInt(77)).toBe(77);
    expect(toInt("77")).toBe(77);
    expect(toInt("77/100")).toBe(77);
    expect(toInt("88%")).toBe(88);
    expect(toInt("+12 points")).toBe(12);
    expect(toInt("3.6")).toBe(4);
  });
  it("returns null for non-numeric / nullish", () => {
    expect(toInt(null)).toBeNull();
    expect(toInt(undefined)).toBeNull();
    expect(toInt("high")).toBeNull();
  });
});

describe("categoryOf", () => {
  it("returns the part before ::", () => {
    expect(categoryOf("Behavior::Response_Time_Decay")).toBe("Behavior");
    expect(categoryOf("NoColon")).toBe("NoColon");
    expect(categoryOf(null)).toBeNull();
  });
});

describe("deriveActionType", () => {
  it("maps to high-level action types", () => {
    expect(deriveActionType({ core_action: "Schedule a QBR call" })).toBe("schedule_meeting");
    expect(deriveActionType({ asset: "battlecard", action_title: "Send battlecard" })).toBe("send_collateral");
    expect(deriveActionType({ action_verb: "Sales::Escalate" })).toBe("create_task");
    expect(deriveActionType({ core_action: "Clarify technical integration" })).toBe("clarify_technical");
    expect(deriveActionType({ action_title: "Email the buyer" })).toBe("draft_email");
  });
});

describe("bootstrapSignalsFromEngagements", () => {
  it("detects replies and demo CTAs", () => {
    const signals = bootstrapSignalsFromEngagements([
      { responseContent: "Yes, let's talk", channel: "email" },
      { message: "Book a demo?", ctaType: "book_demo" },
    ]);
    expect(signals.length).toBeGreaterThanOrEqual(2);
  });
});

describe("shrinkPromptVars", () => {
  it("caps engagement and campaign log size", () => {
    const long = "x".repeat(5000);
    const out = shrinkPromptVars({
      engagements: [{ message: long }],
      campaignContext: [{ commLogs: [{ message: long }] }],
    });
    expect(out.engagements[0].message.length).toBeLessThan(5000);
    expect(out.campaignContext[0].commLogs[0].message.length).toBeLessThan(5000);
  });
});

describe("extractSignalsPayload", () => {
  it("salvages signals from truncated fenced JSON", () => {
    const raw = '```json\n{"signals":[{"signal_type":"Intent::Demo","signal_score":"80"}]';
    expect(extractSignalsPayload(null, raw)).toHaveLength(1);
  });
});

describe("bootstrapSignalsFromTofuCampaign", () => {
  it("builds qualified-lead signals from campaign context", () => {
    const signals = bootstrapSignalsFromTofuCampaign([
      {
        status: "QUALIFIED",
        score: 92,
        qualifiedReason: "positive_reply",
        campaign: { name: "Summer Launch" },
        contact: { businessUser: { name: "Jane Buyer" } },
        commLogs: [
          { message: "Hi Jane", responseContent: "Sounds good — let's talk" },
        ],
      },
    ]);
    expect(signals.length).toBeGreaterThanOrEqual(2);
    expect(signals[0].signal_type).toBe("Intent::Qualified_Lead");
    expect(signals[0].context).toContain("Summer Launch");
  });
});

describe("buildSignalData", () => {
  it("maps an AURA signal to a Signal row", () => {
    const d = buildSignalData("t1", "d1", "a1", {
      signal_type: "Objection::Unclear_ROI",
      signal_score: "82",
      confidence: "90",
      context: "Buyer unsure of payback",
      supporting_quote_customer: "Not sure on ROI",
      supporting_quote_ae: "Here's the calc",
    });
    expect(d).toMatchObject({
      tenantId: "t1",
      dealId: "d1",
      accountId: "a1",
      type: "Objection::Unclear_ROI",
      category: "Objection",
      score: 82,
      confidence: 90,
      headline: "Buyer unsure of payback",
      evidence: "Not sure on ROI",
      suggestedAngle: "Here's the calc",
    });
    expect(d.payload).toBeTruthy();
  });
});

describe("buildNbaData", () => {
  it("maps an AURA nba_action to an NbaRecommendation row", () => {
    const d = buildNbaData("t1", "d1", {
      action_title: "Send ROI battlecard to CFO",
      action_verb: "Value::Demonstrate_ROI_Realization",
      action_score: "70",
      impact_score: "80",
      justification: "CFO blocked on ROI",
      asset: "ROI battlecard",
    });
    expect(d).toMatchObject({
      tenantId: "t1",
      dealId: "d1",
      title: "Send ROI battlecard to CFO",
      actionVerb: "Value::Demonstrate_ROI_Realization",
      actionType: "send_collateral",
      score: 70,
      rationale: "CFO blocked on ROI",
      status: "SUGGESTED",
    });
  });
  it("falls back to impact_score then 0 for score", () => {
    expect(buildNbaData("t", "d", { impact_score: "55" }).score).toBe(55);
    expect(buildNbaData("t", "d", {}).score).toBe(0);
  });
});

describe("buildDealInsightData", () => {
  it("maps the company briefing to a DealInsight row", () => {
    const d = buildDealInsightData(
      "t1",
      "d1",
      { account_score: "73/100", brief_summary: "Solid mid-funnel", your_coach_speaks: "Push for MAP" },
      { model: "gpt-4o-mini", tokensUsed: { total_tokens: 10 } }
    );
    expect(d).toMatchObject({
      tenantId: "t1",
      dealId: "d1",
      score: 73,
      briefing: "Push for MAP",
      summary: "Solid mid-funnel",
      model: "gpt-4o-mini",
      promptVersion: PROMPT_VERSION,
    });
    expect(d.tokensUsed).toEqual({ total_tokens: 10 });
  });
});

// ---------------------------------------------------------------------------
// orchestration with an injected FAKE llm + fake prisma
// ---------------------------------------------------------------------------
function fenced(obj) {
  return "```json\n" + JSON.stringify(obj) + "\n```";
}

// A fake llm whose replies are queued per call order: signal, nba, company.
function queuedLlm(replies) {
  let i = 0;
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: replies[i++] ?? "{}" }],
        usage: { input_tokens: 3, output_tokens: 2 },
      }),
    },
  };
}

const SIGNAL_REPLY = fenced({
  signals: [
    { signal_type: "Objection::Unclear_ROI", signal_score: "82", confidence: "90", context: "ROI doubt" },
    { signal_type: "Behavior::Response_Time_Decay", signal_score: "60", confidence: "70", context: "Slow replies" },
  ],
});
const NBA_REPLY = fenced({
  nba_action: [
    { action_title: "Send ROI battlecard", action_verb: "Value::Demonstrate_ROI_Realization", action_score: "70", asset: "battlecard" },
    { action_title: "Schedule alignment call", action_verb: "Sales::Mutual_Action_Plan", action_score: "55", core_action: "schedule call" },
  ],
});
const COMPANY_REPLY = fenced({
  account_level_briefing: "Acme",
  account_score: "73",
  brief_summary: "Mid-funnel, ROI risk",
  your_coach_speaks: "Push MAP",
});

// fake prisma capturing writes; deal/account context via reader mock below.
function makeFakePrisma() {
  const store = { signals: [], nbas: [], dealInsights: [], companyInsights: [], logs: [], dealUpdates: [] };
  return {
    store,
    tenant: { findUnique: async () => ({ id: "t1", name: "SellerCo", company_details: {} }) },
    communicationLog: { findMany: async () => [{ id: "e1", channel: "email", message: "hi" }] },
    mofuIntegration: { findUnique: async () => ({ insightModel: "gpt-4o-mini" }) },
    deal: {
      findFirst: async () => ({
        id: "d1",
        name: "Acme Deal",
        ownerId: "own1",
        accountId: "a1",
        payload: { hs_object_id: "555" },
        account: { id: "a1", company: { name: "Acme" } },
        dealContacts: [{ contact: { id: "c1", payload: { email: "x@acme.com" } } }],
      }),
      findMany: async () => [],
      update: async (a) => (store.dealUpdates.push(a), { id: "d1" }),
    },
    account: { findFirst: async () => ({ id: "a1", ownerId: "own1", company: { name: "Acme" }, payload: {} }) },
    contact: { findMany: async () => [{ id: "c1", payload: { email: "x@acme.com" } }] },
    dealInsight: {
      findFirst: async () => null,
      create: async (a) => (store.dealInsights.push(a.data), { id: "ins1", ...a.data }),
    },
    companyInsight: {
      findFirst: async () => null,
      create: async (a) => (store.companyInsights.push(a.data), { id: "cins1", ...a.data }),
    },
    nbaRecommendation: {
      findMany: async () => [],
      create: async (a) => (store.nbas.push(a.data), { id: `n${store.nbas.length}`, ...a.data }),
    },
    signal: {
      findMany: async () => store.signals.map((s, i) => ({ id: `s${i}`, ...s })),
      create: async (a) => (store.signals.push(a.data), { id: `s${store.signals.length}`, ...a.data }),
    },
    dealGtmTask: { findMany: async () => [] },
    dealRecording: { findMany: async () => [] },
    assistActionLog: { create: async (a) => (store.logs.push(a.data), { id: "l1" }) },
  };
}

describe("resolveDealAccountIds", () => {
  it("returns the deal account plus accounts for contact companies", async () => {
    const prisma = {
      deal: {
        findFirst: async () => ({
          accountId: "a1",
          dealContacts: [
            { contact: { businessUser: { companyId: "co2" } } },
            { contact: { businessUser: { companyId: "co2" } } },
          ],
        }),
      },
      account: {
        findMany: async () => [{ id: "a2" }],
      },
    };
    await expect(resolveDealAccountIds(prisma, "t1", "d1")).resolves.toEqual(["a1", "a2"]);
  });
});

describe("formatRecomputeSummary", () => {
  it("includes company briefs when present", () => {
    expect(
      formatRecomputeSummary({ signals: 2, nbas: 1, insight: true, companyInsights: 1 })
    ).toContain("1 company brief");
  });
});

describe("recomputeDeal (fake llm + fake prisma)", () => {
  it("writes signals, nbas, a deal insight, company insight, denormalizes score, and logs", async () => {
    const prisma = makeFakePrisma();
    const llm = queuedLlm([SIGNAL_REPLY, NBA_REPLY, COMPANY_REPLY, COMPANY_REPLY]);

    const summary = await recomputeDeal(prisma, "t1", "d1", { llm });

    expect(prisma.store.signals.length).toBe(2);
    expect(prisma.store.signals[0]).toMatchObject({ type: "Objection::Unclear_ROI", category: "Objection", score: 82 });
    expect(prisma.store.nbas.length).toBe(2);
    expect(prisma.store.nbas[0]).toMatchObject({ status: "SUGGESTED", actionType: "send_collateral" });
    expect(prisma.store.dealInsights.length).toBe(1);
    expect(prisma.store.dealInsights[0]).toMatchObject({ score: 73, summary: "Mid-funnel, ROI risk", promptVersion: PROMPT_VERSION });
    expect(prisma.store.companyInsights.length).toBe(1);
    expect(prisma.store.dealUpdates[0]).toMatchObject({ data: { score: 73 } });
    expect(prisma.store.logs.some((l) => l.action === "INSIGHT_COMPUTED")).toBe(true);
    expect(prisma.store.logs.some((l) => l.providerUsage?.total_tokens > 0)).toBe(true);
    expect(summary).toMatchObject({ signals: 2, nbas: 2, insight: true, companyInsights: 1 });
  });

  it("isolates a failing step (bad company JSON) without losing signals/nbas", async () => {
    const prisma = makeFakePrisma();
    const llm = queuedLlm([SIGNAL_REPLY, NBA_REPLY, "not json", "not json"]);
    const summary = await recomputeDeal(prisma, "t1", "d1", { llm });
    expect(summary.signals).toBe(2);
    expect(summary.nbas).toBe(2);
    expect(summary.insight).toBe(true);
    expect(prisma.store.dealInsights.length).toBe(1);
    expect(prisma.store.dealInsights[0].payload).toMatchObject({ source: "bootstrap" });
  });
});

describe("recomputeCompany (fake llm + fake prisma)", () => {
  it("stores a CompanyInsight with the full payload", async () => {
    const prisma = makeFakePrisma();
    const llm = queuedLlm([COMPANY_REPLY]);
    const result = await recomputeCompany(prisma, "t1", "a1", { llm });
    expect(prisma.store.companyInsights.length).toBe(1);
    expect(prisma.store.companyInsights[0].payload).toMatchObject({ account_score: "73" });
    expect(result?.insight).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// real-DB integration (throwaway tenant) — only when DATABASE_URL is present
// ---------------------------------------------------------------------------
describe.skipIf(!process.env.DATABASE_URL)("recomputeDeal (real prisma against clarwiz_v2)", () => {
  let prisma;
  let tenantId;
  let accountId;
  let dealId;
  let businessUserId;

  beforeAll(async () => {
    const { prisma: realPrisma } = await import("@/lib/prisma");
    prisma = realPrisma;
    const stamp = Date.now();
    const tenant = await prisma.tenant.create({ data: { name: `__test_F2_${stamp}` } });
    tenantId = tenant.id;
    const account = await prisma.account.create({
      data: { tenantId, hubspotCompanyId: `hc_${stamp}`, ownerId: "own1", payload: { name: "TestCo" } },
    });
    accountId = account.id;
    const deal = await prisma.deal.create({
      data: {
        tenantId,
        accountId,
        hubspotDealId: `hd_${stamp}`,
        name: "Test Deal",
        ownerId: "own1",
        payload: { hs_object_id: "999" },
      },
    });
    dealId = deal.id;

    // Minimal engagement chain so recomputeSignals has something to run over.
    const bu = await prisma.businessUser.create({ data: { name: `__test_bu_${stamp}` } });
    businessUserId = bu.id;
    const contact = await prisma.contact.create({
      data: { tenantId, businessUserId, hubspotContactId: `hcc_${stamp}` },
    });
    const campaign = await prisma.campaign.create({ data: { tenantId, name: `__test_camp_${stamp}` } });
    const cc = await prisma.campaignContact.create({
      data: { contactId: contact.id, campaignId: campaign.id },
    });
    await prisma.communicationLog.create({
      data: {
        tenantId,
        campaignId: campaign.id,
        campaignContactId: cc.id,
        channel: "email",
        message: "Hi, we're worried about the ROI here.",
        subject: "ROI question",
      },
    });
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    if (businessUserId) {
      await prisma.businessUser.delete({ where: { id: businessUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("persists Signal / Nba / DealInsight rows and denormalizes deal.score", async () => {
    const llm = queuedLlm([SIGNAL_REPLY, NBA_REPLY, COMPANY_REPLY]);
    const summary = await recomputeDeal(prisma, tenantId, dealId, { llm });

    const [signals, nbas, insight, deal] = await Promise.all([
      prisma.signal.findMany({ where: { tenantId, dealId } }),
      prisma.nbaRecommendation.findMany({ where: { tenantId, dealId } }),
      prisma.dealInsight.findFirst({ where: { dealId }, orderBy: { computedAt: "desc" } }),
      prisma.deal.findUnique({ where: { id: dealId } }),
    ]);

    expect(signals.length).toBe(2);
    expect(signals[0].category).toBe(signals[0].type.split("::")[0]);
    expect(nbas.length).toBe(2);
    expect(nbas.every((n) => n.status === "SUGGESTED")).toBe(true);
    expect(insight).toBeTruthy();
    expect(insight.score).toBe(73);
    expect(insight.promptVersion).toBe(PROMPT_VERSION);
    expect(deal.score).toBe(73);
    expect(summary.insight).toBe(true);
  });

  it("persists a CompanyInsight row", async () => {
    const llm = queuedLlm([COMPANY_REPLY]);
    const result = await recomputeCompany(prisma, tenantId, accountId, { llm });
    expect(result?.insight).toBeTruthy();
    const stored = await prisma.companyInsight.findFirst({ where: { accountId }, orderBy: { computedAt: "desc" } });
    expect(stored.payload.account_score).toBe("73");
    expect(stored.promptVersion).toBe(PROMPT_VERSION);
  });
});

import { describe, it, expect } from "vitest";
import { runAssistAgent, compactPipeline, compactDeal, compactCompany } from "./assistAgent.js";

describe("compaction helpers (pure)", () => {
  it("compacts a pipeline into bounded ids/names/scores", () => {
    const out = compactPipeline({
      deals: [{ id: "D1", name: "Acme", stageLabel: "Proposal", amount: 5000, status: "OPEN", score: 70 }],
      leads: [{ id: "C1", businessUser: { name: "Lee", company: { name: "Beta" } } }],
      accounts: [{ id: "A1", company: { name: "Acme" }, _count: { deals: 2 } }],
    });
    expect(out.kind).toBe("dashboard");
    expect(out.openDeals[0]).toMatchObject({ id: "D1", name: "Acme", score: 70 });
    expect(out.leads[0]).toMatchObject({ id: "C1", name: "Lee" });
    expect(out.accounts[0]).toMatchObject({ id: "A1", deals: 2 });
  });

  it("compacts a deal view with top signals/nbas", () => {
    const out = compactDeal({
      deal: { id: "D1", name: "Acme", stageLabel: "Proposal", amount: 5000, status: "OPEN", score: 70 },
      company: { name: "Acme", industry: "TECH" },
      insight: { score: 70, summary: "Healthy", briefing: "..." },
      signals: [{ id: "s1", headline: "Pricing pushback", category: "OBJECTION", score: 80 }],
      nbas: [{ id: "n1", title: "Send ROI deck", actionType: "draft_email", status: "SUGGESTED", score: 8 }],
    });
    expect(out.kind).toBe("deal");
    expect(out.deal.id).toBe("D1");
    expect(out.insightSummary).toBe("Healthy");
    expect(out.topSignals[0].headline).toBe("Pricing pushback");
    expect(out.topNbas[0].title).toBe("Send ROI deck");
  });

  it("compacts a company view", () => {
    const out = compactCompany({
      account: { id: "A1" },
      company: { name: "Acme", industry: "TECH" },
      deals: [{ id: "D1", name: "Acme", stageLabel: "Proposal", status: "OPEN" }],
      signals: [{ id: "s1", headline: "Expansion", score: 60 }],
    });
    expect(out.kind).toBe("company");
    expect(out.company.name).toBe("Acme");
    expect(out.deals[0].id).toBe("D1");
  });
});

describe("runAssistAgent (tool-use loop)", () => {
  it("executes a tool call then returns the final text", async () => {
    const sequence = [
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_deal_detail", input: { dealId: "D1" } }],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Acme is healthy; send the ROI deck." }] },
    ];
    const seen = [];
    const fakeClient = { messages: { create: async (req) => (seen.push(req), sequence.shift()) } };
    const toolCalls = [];

    const res = await runAssistAgent({
      prisma: {},
      tenantId: "t1",
      messages: [{ role: "user", content: "How is deal D1 doing?" }],
      pageContext: { entityType: "deal", id: "D1", name: "Acme" },
      client: fakeClient,
      ground: async () => ({ kind: "empty" }),
      executeTool: async (_p, _t, name, input) => {
        toolCalls.push({ name, input });
        return JSON.stringify({ score: 75 });
      },
    });

    expect(res.reply).toBe("Acme is healthy; send the ROI deck.");
    expect(toolCalls).toEqual([{ name: "get_deal_detail", input: { dealId: "D1" } }]);
    // Requests must carry adaptive thinking + tools and NO temperature (Opus 4.8 would 400).
    expect(seen[0].thinking).toEqual({ type: "adaptive" });
    expect(seen[0].temperature).toBeUndefined();
    expect(Array.isArray(seen[0].tools)).toBe(true);
  });

  it("stops at the iteration cap and returns a graceful fallback", async () => {
    const fakeClient = {
      messages: {
        create: async () => ({
          stop_reason: "tool_use",
          content: [{ type: "tool_use", id: "x", name: "get_pipeline_overview", input: {} }],
        }),
      },
    };
    const res = await runAssistAgent({
      prisma: {},
      tenantId: "t1",
      messages: [{ role: "user", content: "loop forever" }],
      client: fakeClient,
      ground: async () => ({ kind: "empty" }),
      executeTool: async () => "{}",
      maxIterations: 3,
    });
    expect(res.iterations).toBe(3);
    expect(res.reply).toMatch(/narrow|able to/i);
  });
});

import { describe, it, expect } from "vitest";
import { runAssistAgent } from "./assistAgent.js";
import { compactCockpitDealContext, buildContactProfile } from "./cockpit/dealContext.js";

describe("compactCockpitDealContext", () => {
  it("includes deal, contacts, intelligence, and scope", () => {
    const snap = compactCockpitDealContext({
      view: {
        deal: { id: "d1", name: "Acme Expansion", hubspotDealId: "hd1" },
        dealContacts: [{ contactId: "c1", role: "Champion" }],
        contacts: [
          {
            id: "c1",
            persona: "DECISION_MAKER",
            businessUser: {
              id: "bu1",
              name: "Jane Buyer",
              email: "j@acme.com",
              phone: "+1 555-0100",
              whatsapp: "+1 555-0101",
              linkedinUrl: "https://linkedin.com/in/jane",
              jobTitle: "VP Eng",
              company: { name: "Acme Corp" },
            },
          },
        ],
        signals: [{ id: "s1", headline: "Budget confirmed", score: 80 }],
        nbas: [{ id: "n1", title: "Send ROI deck", status: "SUGGESTED", score: 9 }],
      },
      vm: {
        deal: {
          id: "d1",
          name: "Acme Expansion",
          stageLabel: "Proposal",
          amount: 50000,
          score: 72,
          status: "OPEN",
        },
        account: { id: "a1" },
        company: { name: "Acme Corp", industry: "SaaS" },
        contacts: [
          {
            id: "c1",
            name: "Jane Buyer",
            email: "j@acme.com",
            title: "VP Eng",
            persona: "DECISION_MAKER",
          },
        ],
        hasInsight: true,
        insightComputedAt: "2026-01-01T00:00:00.000Z",
        accountScore: 72,
        briefing: { briefSummary: "Strong momentum." },
        insightDetected: { label: "Momentum", explanation: "Champion engaged" },
        likelihoodToProgress: "High",
        followUpEffort: "Medium",
        positiveOutcomes: ["Budget holder engaged"],
        earlyWarnings: [],
        coachingTip: "Lead with ROI",
        recommendedActions: { ae: ["Schedule exec call"] },
        gtmPaths: [{ title: "Champion path", steps: ["Call", "Demo"], scoreImpact: 5 }],
        gtmTasks: {},
      },
      companyInsight: null,
      accountSignals: [],
      recordings: [],
      campaignContexts: [
        {
          id: "cc1",
          status: "QUALIFIED",
          score: 85,
          campaign: { name: "Summer 2025" },
          contact: { id: "c1", businessUser: { name: "Jane Buyer" } },
          commLogs: [
            {
              channel: "email",
              subject: "Intro",
              message: "Hi Jane",
              sentAt: "2026-01-02T00:00:00.000Z",
              status: "sent",
            },
          ],
        },
      ],
      tofuViews: [],
      scope: {
        dealId: "d1",
        dealName: "Acme Expansion",
        accountId: "a1",
        companyName: "Acme Corp",
        hubspotDealId: "hd1",
        contactIds: ["c1"],
      },
    });

    expect(snap.kind).toBe("cockpit_deal");
    expect(snap.scope.dealId).toBe("d1");
    expect(snap.deal.name).toBe("Acme Expansion");
    expect(snap.contacts[0].roleOnDeal).toBe("Champion");
    expect(snap.contacts[0].phone).toBe("+1 555-0100");
    expect(snap.contacts[0].whatsapp).toBe("+1 555-0101");
    expect(snap.contacts[0].linkedinUrl).toBe("https://linkedin.com/in/jane");
    expect(snap.contacts[0].tofu.campaignName).toBe("Summer 2025");
    expect(snap.intelligence.briefing.briefSummary).toBe("Strong momentum.");
    expect(snap.signals[0].headline).toBe("Budget confirmed");
  });

  it("falls back to TOFU prospect phone when BusinessUser.phone is empty", () => {
    const profile = buildContactProfile(
      { id: "c1", persona: "CHAMPION", businessUser: { name: "Jane", email: "j@acme.com" } },
      {
        dealContacts: [],
        campaignContexts: [],
        tofuViews: [
          {
            prospect: {
              contactId: "c1",
              phone: "+1 555-9999",
              whatsapp: "+1 555-8888",
            },
          },
        ],
      }
    );
    expect(profile.phone).toBe("+1 555-9999");
    expect(profile.whatsapp).toBe("+1 555-8888");
  });
});

describe("runAssistAgent (Cockpit deal scope)", () => {
  it("executes a deal-scoped tool then returns the final text", async () => {
    const sequence = [
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "t1", name: "get_contact_conversations", input: { contactId: "c1" } },
        ],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Jane replied positively on email." }] },
    ];
    const seen = [];
    const fakeClient = { messages: { create: async (req) => (seen.push(req), sequence.shift()) } };
    const toolCalls = [];

    const res = await runAssistAgent({
      prisma: {},
      tenantId: "t1",
      messages: [{ role: "user", content: "What did Jane say?" }],
      pageContext: { entityType: "deal", id: "D1", name: "Acme" },
      client: fakeClient,
      ground: async () => ({
        kind: "cockpit_deal",
        scope: { dealId: "D1", contactIds: ["c1"] },
        deal: { name: "Acme" },
      }),
      executeTool: async (_p, _t, dealId, name, input) => {
        toolCalls.push({ dealId, name, input });
        return JSON.stringify({ conversations: [] });
      },
    });

    expect(res.reply).toBe("Jane replied positively on email.");
    expect(toolCalls).toEqual([
      { dealId: "D1", name: "get_contact_conversations", input: { contactId: "c1" } },
    ]);
    expect(seen[0].system).toMatch(/locked to deal id "D1"/i);
    expect(seen[0].tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "get_contact_conversations" })])
    );
  });

  it("refuses when not on a deal workroom", async () => {
    const res = await runAssistAgent({
      prisma: {},
      tenantId: "t1",
      messages: [{ role: "user", content: "Hello" }],
      pageContext: { entityType: "pipeline" },
      client: { messages: { create: async () => ({ stop_reason: "end_turn", content: [] }) } },
    });
    expect(res.reply).toMatch(/deal workroom/i);
    expect(res.iterations).toBe(0);
  });
});

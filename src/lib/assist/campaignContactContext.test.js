import { describe, it, expect } from "vitest";
import {
  collectCampaignContactIds,
  formatCampaignContactContext,
  campaignContextsToEngagements,
  enrichContactsWithCampaignContext,
} from "./campaignContactContext.js";

describe("collectCampaignContactIds", () => {
  it("dedupes ids from deal, account, and deal contacts", () => {
    const ids = collectCampaignContactIds({
      deal: { campaignContactId: "cc-1" },
      account: { campaignContactId: "cc-1" },
      dealContacts: [{ campaignContactId: "cc-2" }],
    });
    expect(ids.sort()).toEqual(["cc-1", "cc-2"]);
  });
});

describe("formatCampaignContactContext", () => {
  it("shapes score, persona, and comm logs", () => {
    const out = formatCampaignContactContext({
      id: "cc-1",
      status: "QUALIFIED",
      score: 92,
      scoreBreakdown: { reply: 40 },
      qualifiedReason: "positive_reply",
      campaign: { id: "c1", name: "Summer" },
      contact: {
        id: "ct-1",
        persona: "CHAMPION",
        businessUser: { email: "a@b.com" },
      },
      commLogs: [{ id: "log-1", channel: "email", message: "hi", sentAt: new Date() }],
    });
    expect(out.score).toBe(92);
    expect(out.contact.persona).toBe("CHAMPION");
    expect(out.commLogs).toHaveLength(1);
  });
});

describe("campaignContextsToEngagements", () => {
  it("emits inbound reply rows and sorts newest first", () => {
    const rows = campaignContextsToEngagements([
      {
        id: "cc-1",
        campaign: { name: "Q2" },
        commLogs: [
          {
            id: "l1",
            channel: "email",
            message: "out",
            sentAt: "2026-06-01T00:00:00Z",
            responseContent: "yes",
            responseAt: "2026-06-02T00:00:00Z",
          },
        ],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("clarwiz_tofu");
    expect(rows[0].direction).toBe("inbound");
  });
});

describe("enrichContactsWithCampaignContext", () => {
  it("adds tofu score and persona to matching CRM contacts", () => {
    const out = enrichContactsWithCampaignContext(
      [{ id: "ct-1", persona: null }],
      [
        {
          id: "cc-1",
          score: 88,
          status: "QUALIFIED",
          qualifiedReason: "demo",
          campaign: { name: "Summer" },
          contact: { id: "ct-1", persona: "DECISION_MAKER" },
        },
      ]
    );
    expect(out[0].persona).toBe("DECISION_MAKER");
    expect(out[0].tofuScore).toBe(88);
    expect(out[0].campaignName).toBe("Summer");
  });
});

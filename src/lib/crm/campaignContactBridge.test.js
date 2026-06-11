import { describe, it, expect, vi } from "vitest";
import {
  CLARWIZ_CAMPAIGN_CONTACT_ID_PROP,
  extractCampaignContactId,
  resolveCampaignContactId,
} from "./campaignContactBridge.js";

describe("extractCampaignContactId", () => {
  it("reads the clarwiz property from a HubSpot payload", () => {
    expect(
      extractCampaignContactId({ [CLARWIZ_CAMPAIGN_CONTACT_ID_PROP]: "cc-abc" })
    ).toBe("cc-abc");
    expect(extractCampaignContactId({})).toBeNull();
  });
});

describe("resolveCampaignContactId", () => {
  it("prefers the HubSpot property when it matches a tenant campaign contact", async () => {
    const prisma = {
      campaignContact: {
        findFirst: vi.fn().mockResolvedValue({ id: "cc-from-prop" }),
      },
    };
    const id = await resolveCampaignContactId(prisma, "t1", {
      payload: { [CLARWIZ_CAMPAIGN_CONTACT_ID_PROP]: "cc-from-prop" },
      hubspotDealId: "HS-1",
    });
    expect(id).toBe("cc-from-prop");
  });

  it("falls back to hubspotDealId on CampaignContact", async () => {
    const prisma = {
      campaignContact: {
        findFirst: vi.fn().mockResolvedValue({ id: "cc-from-deal" }),
      },
    };
    const id = await resolveCampaignContactId(prisma, "t1", {
      payload: {},
      hubspotDealId: "HS-99",
    });
    expect(id).toBe("cc-from-deal");
  });
});

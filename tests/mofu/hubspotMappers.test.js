import { describe, it, expect } from "vitest";
import { mapHubSpotDeal } from "@/lib/hubspot/hubspotMappers";

describe("mapHubSpotDeal", () => {
  it("maps HubSpot deal JSON to live fields", () => {
    const hs = {
      id: "326239164100",
      properties: {
        dealname: "Acme",
        dealstage: "qualifiedtobuy",
        hubspot_owner_id: "55",
        amount: "12000",
        deal_currency_code: "USD",
      },
    };
    const out = mapHubSpotDeal(hs);
    expect(out).toMatchObject({
      hubspotDealId: "326239164100",
      name: "Acme",
      live: { stage: "qualifiedtobuy", owner: "55", amount: 12000, currency: "USD" },
    });
  });

  it("tolerates missing optional props without throwing", () => {
    const out = mapHubSpotDeal({ id: "d2", properties: {} });
    expect(out.live).toMatchObject({ stage: null, owner: null, amount: null, currency: null });
    expect(Array.isArray(out.live.timeline)).toBe(true);
  });
});

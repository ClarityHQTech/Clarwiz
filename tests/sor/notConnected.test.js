import { describe, it, expect, vi } from "vitest";

// HubSpot not connected for this tenant.
vi.mock("@/lib/hubspot/hubspotIntegration", () => ({
  getHubSpotIntegration: async () => null,
  isHubSpotConnected: () => false,
  decryptHubSpotToken: (s) => s,
}));

import { hubspotAdapter } from "@/lib/sor/hubspotAdapter";

describe("SorAdapter not-connected behavior", () => {
  it("getDeal returns a structured no-op (never throws)", async () => {
    const out = await hubspotAdapter.getDeal("tenant_x", "d1");
    expect(out).toEqual({ ok: false, reason: "sor_not_connected" });
  });

  it("getDealEngagements returns a structured no-op", async () => {
    const out = await hubspotAdapter.getDealEngagements("tenant_x", "d1");
    expect(out).toEqual({ ok: false, reason: "sor_not_connected" });
  });
});

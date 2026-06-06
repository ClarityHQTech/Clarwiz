import { describe, it, expect, vi } from "vitest";
import { deriveCapabilities, gateCard, discoverCapabilities } from "@/lib/mofu/capabilities";

vi.mock("@/lib/hubspot/hubspotIntegration", () => ({
  getHubSpotIntegration: async () => ({
    status: "connected",
    encryptedAccessToken: "x",
    scopes: ["crm.objects.deals.read", "sales-email-read"],
  }),
  isHubSpotConnected: (i) => !!i && i.status === "connected" && !!i.encryptedAccessToken,
}));

describe("capabilities (US-5.1)", () => {
  it("derives EMAIL present from sales-email scope, CALLING absent", () => {
    const present = deriveCapabilities({
      status: "connected",
      encryptedAccessToken: "x",
      scopes: ["sales-email-read"],
    });
    expect(present.EMAIL).toBe(true);
    expect(present.CALLING).toBe(false);
  });

  it("fails closed when not connected", () => {
    const present = deriveCapabilities({ status: "pending", encryptedAccessToken: null, scopes: [] });
    expect(Object.values(present).every((v) => v === false)).toBe(true);
  });

  it("gateCard returns a connect CTA for a missing capability, executable for none-required", () => {
    expect(gateCard("CALL_WITH_SCRIPT", { CALLING: false })).toMatchObject({
      executable: false,
      cta: "Connect CALLING to HubSpot",
    });
    expect(gateCard("SEND_EMAIL", { EMAIL: true })).toMatchObject({ executable: true, cta: null });
    expect(gateCard("PREP_MEETING", {})).toMatchObject({ executable: true });
  });

  it("discoverCapabilities upserts a row per capability", async () => {
    const upserts = [];
    const prisma = {
      tenantCapability: {
        upsert: vi.fn(async (a) => {
          upserts.push(a.create);
          return a.create;
        }),
      },
    };
    const out = await discoverCapabilities("t1", { prisma });
    expect(out.present.EMAIL).toBe(true);
    expect(upserts.length).toBe(4); // EMAIL, CALLING, MEETING_SCHEDULER, NOTE_TAKER
  });
});

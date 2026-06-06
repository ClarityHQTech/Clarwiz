import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  connectHubSpotFromPat,
  isHubSpotConnected,
} from "@/lib/hubspot/hubspotIntegration";

beforeAll(() => {
  process.env.SECRET = process.env.SECRET || "test_secret_value_for_unit_tests";
});

describe("HubSpot integration store (PAT)", () => {
  it("stores a PAT encrypted at rest and reports connected", async () => {
    let saved;
    const prisma = {
      hubSpotIntegration: {
        upsert: vi.fn(async (a) => {
          saved = { ...a.create };
          return saved;
        }),
      },
    };
    const row = await connectHubSpotFromPat("t1", "pat-na2-abc-123", {
      prisma,
      portalId: "246271093",
    });
    expect(saved.encryptedAccessToken).toBeTruthy();
    expect(saved.encryptedAccessToken).not.toContain("pat-na2-abc-123");
    expect(saved.portalId).toBe("246271093");
    expect(isHubSpotConnected(row)).toBe(true);
  });

  it("throws when token is blank", async () => {
    const prisma = { hubSpotIntegration: { upsert: vi.fn() } };
    await expect(connectHubSpotFromPat("t1", "  ", { prisma })).rejects.toThrow(
      "hubspot_pat_required"
    );
    expect(prisma.hubSpotIntegration.upsert).not.toHaveBeenCalled();
  });

  it("isHubSpotConnected is false without a token", () => {
    expect(isHubSpotConnected({ status: "connected", encryptedAccessToken: null })).toBe(false);
    expect(isHubSpotConnected({ status: "pending", encryptedAccessToken: "x" })).toBe(false);
    expect(isHubSpotConnected(null)).toBe(false);
  });
});

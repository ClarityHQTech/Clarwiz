import { describe, it, expect } from "vitest";
import {
  maskToken,
  buildMofuIntegrationData,
  upsertMofuIntegration,
  toDisplayConfig,
  getDecryptedHubspotToken,
} from "./mofuIntegration.js";
import { encryptMofuToken, decryptMofuToken } from "@/lib/encryptSecret";

describe("maskToken", () => {
  it("masks all but the last 4 characters", () => {
    expect(maskToken("pat-na2-secretWXYZ")).toBe("••••WXYZ");
  });
  it("returns null for a missing token", () => {
    expect(maskToken(null)).toBeNull();
    expect(maskToken("")).toBeNull();
  });
});

describe("buildMofuIntegrationData", () => {
  it("encrypts the HubSpot token (never plaintext) and round-trips", () => {
    const data = buildMofuIntegrationData({ hubspotToken: "pat-na2-raw" });
    expect(data.encryptedHubspotToken).not.toBe("pat-na2-raw");
    expect(decryptMofuToken(data.encryptedHubspotToken)).toBe("pat-na2-raw");
  });
  it("passes optional config through and defaults the rest to null", () => {
    const full = buildMofuIntegrationData({
      hubspotToken: "t",
      hubspotPortalId: "12345",
      defaultOwnerId: "67",
      insightModel: "gpt-4o",
    });
    expect(full.hubspotPortalId).toBe("12345");
    expect(full.defaultOwnerId).toBe("67");
    expect(full.insightModel).toBe("gpt-4o");

    const bare = buildMofuIntegrationData({ hubspotToken: "t" });
    expect(bare.hubspotPortalId).toBeNull();
    expect(bare.defaultOwnerId).toBeNull();
    expect(bare.insightModel).toBeNull();
  });
  it("throws when hubspotToken is missing", () => {
    expect(() => buildMofuIntegrationData({})).toThrow();
  });
});

describe("upsertMofuIntegration", () => {
  it("upserts by tenantId with encrypted data on both create and update", async () => {
    let captured;
    const prisma = {
      mofuIntegration: {
        upsert: async (args) => {
          captured = args;
          return { id: "1" };
        },
      },
    };
    await upsertMofuIntegration(prisma, "tenant-1", { hubspotToken: "pat-na2-raw" });
    expect(captured.where).toEqual({ tenantId: "tenant-1" });
    expect(captured.create.tenantId).toBe("tenant-1");
    expect(decryptMofuToken(captured.create.encryptedHubspotToken)).toBe("pat-na2-raw");
    expect(decryptMofuToken(captured.update.encryptedHubspotToken)).toBe("pat-na2-raw");
  });
});

describe("toDisplayConfig", () => {
  it("returns not-configured for a null row", () => {
    expect(toDisplayConfig(null)).toEqual({ configured: false });
  });
  it("masks the token and never exposes plaintext or ciphertext", () => {
    const row = {
      encryptedHubspotToken: encryptMofuToken("pat-na2-secretWXYZ"),
      hubspotPortalId: "123",
      defaultOwnerId: null,
      insightModel: "gpt-4o",
      status: "connected",
      connectedAt: null,
    };
    const out = toDisplayConfig(row);
    expect(out.configured).toBe(true);
    expect(out.hubspotTokenMasked).toBe("••••WXYZ");

    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("pat-na2-secretWXYZ");
    expect(serialized).not.toContain(row.encryptedHubspotToken);
  });
});

describe("getDecryptedHubspotToken", () => {
  it("returns the original token for a configured tenant", async () => {
    const row = { encryptedHubspotToken: encryptMofuToken("pat-na2-roundtrip") };
    const prisma = { mofuIntegration: { findUnique: async () => row } };
    expect(await getDecryptedHubspotToken(prisma, "t")).toBe("pat-na2-roundtrip");
  });
  it("returns null when the tenant has no integration", async () => {
    const prisma = { mofuIntegration: { findUnique: async () => null } };
    expect(await getDecryptedHubspotToken(prisma, "t")).toBeNull();
  });
});

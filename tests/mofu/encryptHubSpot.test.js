import { describe, it, expect, beforeAll } from "vitest";
import { encryptHubSpotToken, decryptHubSpotToken } from "@/lib/encryptSecret";

beforeAll(() => {
  process.env.SECRET = process.env.SECRET || "test_secret_value_for_unit_tests";
});

describe("HubSpot token crypto", () => {
  it("round-trips a PAT", () => {
    const token = "test-pat-token-redacted";
    const enc = encryptHubSpotToken(token);
    expect(enc).not.toContain(token); // encrypted at rest
    expect(decryptHubSpotToken(enc)).toBe(token);
  });

  it("uses a distinct key from other integrations (calendly cannot decrypt it)", async () => {
    const { decryptCalendlyToken } = await import("@/lib/encryptSecret");
    const enc = encryptHubSpotToken("pat-na2-abc-123");
    expect(() => decryptCalendlyToken(enc)).toThrow();
  });

  it("throws on empty input (matches repo convention)", () => {
    expect(() => encryptHubSpotToken("")).toThrow();
  });
});

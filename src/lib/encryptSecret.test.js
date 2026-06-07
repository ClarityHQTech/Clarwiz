import { describe, it, expect } from "vitest";
import { encryptMofuToken, decryptMofuToken } from "./encryptSecret.js";

describe("MOFU integration token encryption", () => {
  it("round-trips a token back to the original plaintext", () => {
    const token = "sample-private-app-token-value";
    const stored = encryptMofuToken(token);

    expect(stored).not.toBe(token); // not stored in plaintext
    expect(decryptMofuToken(stored)).toBe(token);
  });

  it("produces base64 ciphertext that differs each call (random IV)", () => {
    const a = encryptMofuToken("same-token");
    const b = encryptMofuToken("same-token");

    expect(a).not.toBe(b); // random IV per encryption
    expect(decryptMofuToken(a)).toBe("same-token");
    expect(decryptMofuToken(b)).toBe("same-token");
  });
});

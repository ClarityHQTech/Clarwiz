import { describe, it, expect } from "vitest";
import { isPersonalEmail } from "./resolveBusinessUser.js";

describe("isPersonalEmail", () => {
  it("returns true for free-mail addresses", () => {
    expect(isPersonalEmail("user@gmail.com")).toBe(true);
    expect(isPersonalEmail("user@outlook.com")).toBe(true);
    expect(isPersonalEmail("user@hotmail.com")).toBe(true);
  });

  it("returns false for business domains", () => {
    expect(isPersonalEmail("user@acme.com")).toBe(false);
    expect(isPersonalEmail("user@example.com")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isPersonalEmail("")).toBe(false);
    expect(isPersonalEmail(null)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  fillTemplate,
  SIGNAL_SYSTEM,
  SIGNAL_USER,
  NBA_SYSTEM,
  NBA_USER,
  COMPANY_SYSTEM,
  COMPANY_USER,
} from "./index.js";

describe("fillTemplate", () => {
  it("replaces a simple {{key}} placeholder with the string value", () => {
    expect(fillTemplate("Hello {{name}}!", { name: "Ada" })).toBe("Hello Ada!");
  });

  it("replaces every occurrence of the same placeholder", () => {
    expect(fillTemplate("{{x}}-{{x}}", { x: "z" })).toBe("z-z");
  });

  it("JSON.stringifies object/array values", () => {
    expect(fillTemplate("{{o}}", { o: { a: 1 } })).toBe('{"a":1}');
    expect(fillTemplate("{{a}}", { a: [1, 2] })).toBe("[1,2]");
  });

  it("substitutes empty string for missing/undefined/null vars", () => {
    expect(fillTemplate("[{{missing}}]", {})).toBe("[]");
    expect(fillTemplate("[{{n}}]", { n: null })).toBe("[]");
    expect(fillTemplate("[{{u}}]", { u: undefined })).toBe("[]");
  });

  it("handles whitespace inside the braces", () => {
    expect(fillTemplate("{{ name }}", { name: "ok" })).toBe("ok");
  });

  it("passes numbers through as their string form", () => {
    expect(fillTemplate("{{n}}", { n: 42 })).toBe("42");
  });

  it("leaves text without placeholders untouched", () => {
    expect(fillTemplate("plain text", { a: 1 })).toBe("plain text");
  });
});

describe("prompt templates", () => {
  it("exports non-empty system + user strings for each prompt", () => {
    for (const t of [SIGNAL_SYSTEM, SIGNAL_USER, NBA_SYSTEM, NBA_USER, COMPANY_SYSTEM, COMPANY_USER]) {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    }
  });

  it("user templates contain the expected placeholders", () => {
    expect(SIGNAL_USER).toContain("{{ontology}}");
    expect(SIGNAL_USER).toContain("{{engagements}}");
    expect(NBA_USER).toContain("{{signals}}");
    expect(COMPANY_USER).toContain("{{previousInsights}}");
  });
});

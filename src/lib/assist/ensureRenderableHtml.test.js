import { describe, it, expect } from "vitest";
import { ensureRenderableHtmlDocument, foldBase64 } from "./ensureRenderableHtml.js";

describe("ensureRenderableHtmlDocument", () => {
  it("passes through a full HTML document", () => {
    const doc = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body><p>Hi</p></body></html>";
    expect(ensureRenderableHtmlDocument(doc)).toBe(doc);
  });

  it("decodes entity-escaped HTML", () => {
    const escaped = "&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;body&gt;&lt;p&gt;Hi&lt;/p&gt;&lt;/body&gt;&lt;/html&gt;";
    const out = ensureRenderableHtmlDocument(escaped);
    expect(out).toContain("<!DOCTYPE html>");
    expect(out).toContain("<p>Hi</p>");
    expect(out).not.toContain("&lt;p&gt;");
  });

  it("wraps HTML fragments in a complete document", () => {
    const out = ensureRenderableHtmlDocument("<p>Fragment</p>");
    expect(out).toMatch(/<!DOCTYPE html>/i);
    expect(out).toContain("<p>Fragment</p>");
  });
});

describe("foldBase64", () => {
  it("wraps base64 at 76 characters per line", () => {
    const folded = foldBase64("a".repeat(100));
    const lines = folded.split("\r\n");
    expect(lines.every((line) => line.length <= 76)).toBe(true);
    expect(lines.join("")).toHaveLength(100);
  });
});

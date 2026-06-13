import { describe, expect, it } from "vitest";
import { plainTextToHtml } from "@/lib/assist/plainTextToHtml";
import { sanitizePdfFilename } from "@/lib/assist/crmEmailCollateral";

describe("plainTextToHtml", () => {
  it("wraps paragraphs and preserves line breaks", () => {
    const html = plainTextToHtml("Hello\nworld\n\nSecond block");
    expect(html).toContain("<p>Hello<br/>world</p>");
    expect(html).toContain("<p>Second block</p>");
  });

  it("escapes HTML characters", () => {
    expect(plainTextToHtml("<script>")).toContain("&lt;script&gt;");
  });
});

describe("sanitizePdfFilename", () => {
  it("adds .pdf extension", () => {
    expect(sanitizePdfFilename("Battle Card")).toBe("Battle_Card.pdf");
  });
});

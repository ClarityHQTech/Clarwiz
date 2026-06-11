import { describe, it, expect } from "vitest";
import {
  stripCollateralViewerLinks,
  sanitizeAttachmentFilename,
  embedCollateralInline,
} from "./nbaEmailCollateral.js";

describe("stripCollateralViewerLinks", () => {
  it("removes in-app collateral viewer links", () => {
    const html =
      '<p>Hello</p><p style="margin-top:16px"><a href="/assist/collaterals?open=doc1">View / edit asset →</a></p>';
    expect(stripCollateralViewerLinks(html)).toBe("<p>Hello</p>");
  });
});

describe("sanitizeAttachmentFilename", () => {
  it("produces a safe .html filename", () => {
    expect(sanitizeAttachmentFilename("ROI Deck (Q2)")).toBe("ROI_Deck_Q2.html");
  });
});

describe("embedCollateralInline", () => {
  it("appends collateral HTML below the message", () => {
    const out = embedCollateralInline("<p>Hi</p>", "<html><body>Deck</body></html>", "ROI Deck");
    expect(out).toContain("<p>Hi</p>");
    expect(out).toContain("ROI Deck");
    expect(out).toContain("<body>Deck</body>");
  });
});

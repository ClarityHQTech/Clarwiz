import { describe, it, expect } from "vitest";
import { renderDocumentHtml, mdToHtml, escapeHtml } from "./renderDocument.js";

const ONE_PAGER = {
  title: "Acme x Clarwiz — Security One-Pager",
  assetType: "one_pager",
  headline: "De-risk your rollout in 30 days",
  subhead: "Built for Acme's security team",
  audience: "CISO",
  sections: [
    {
      id: "problem",
      title: "The problem",
      body: "Manual reviews are **slow**.\n\n- No audit trail\n- High toil",
    },
    { id: "solution", title: "The solution", body: "Automated controls." },
  ],
  metrics: [
    { label: "18-mo TCO", value: "$420k", detail: "vs incumbent" },
    { label: "Time saved", value: "12 hrs/wk", detail: "per analyst" },
  ],
  cta: { label: "Book a 30-min ROI review", detail: "with your AE" },
  compliance: { score: "88", note: "On-brand" },
};

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml('<b>&"x"</b>')).toBe("&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;");
  });
  it("handles non-string input safely", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("mdToHtml", () => {
  it("converts headings, bold and lists", () => {
    const html = mdToHtml("## Title\n\nSome **bold** text.\n\n- a\n- b");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>a</li>");
  });

  it("escapes raw HTML in the markdown body (no script injection)", () => {
    const html = mdToHtml("Hello <script>alert(1)</script> world");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders a simple table", () => {
    const html = mdToHtml("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("returns empty string for empty/non-string input", () => {
    expect(mdToHtml("")).toBe("");
    expect(mdToHtml(null)).toBe("");
  });
});

describe("renderDocumentHtml — one_pager", () => {
  const html = renderDocumentHtml(ONE_PAGER);

  it("is a complete, self-contained document with no scripts", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<style>");
    expect(html).not.toContain("<script");
  });

  it("includes the headline, a section title, and a metric value", () => {
    expect(html).toContain("De-risk your rollout in 30 days");
    expect(html).toContain("The problem");
    expect(html).toContain("$420k");
    expect(html).toContain("18-mo TCO");
  });

  it("includes the CTA and the amber accent token", () => {
    expect(html).toContain("Book a 30-min ROI review");
    expect(html).toContain("#F2A65A");
  });

  it("renders markdown bodies as HTML, not raw markdown", () => {
    expect(html).toContain("<strong>slow</strong>");
    expect(html).toContain("<li>No audit trail</li>");
  });

  it("links a Google Fonts stylesheet", () => {
    expect(html).toContain("fonts.googleapis.com");
  });
});

describe("renderDocumentHtml — assetType layouts", () => {
  it("renders a battlecard with us-vs-competitor and rebuttals", () => {
    const doc = {
      title: "Battlecard",
      assetType: "battlecard",
      headline: "Clarwiz vs Incumbent",
      competitor: "Incumbent Inc",
      capabilities: [
        { name: "SSO", us: "Native", them: "Add-on" },
        { name: "Audit log", us: "Yes", them: "No" },
      ],
      objections: [
        { objection: "Too expensive", rebuttal: "TCO is 30% lower" },
      ],
      sections: [],
    };
    const html = renderDocumentHtml(doc);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("Incumbent Inc");
    expect(html).toContain("SSO");
    expect(html).toContain("Too expensive");
    expect(html).toContain("TCO is 30% lower");
    expect(html).not.toContain("<script");
  });

  it("renders a case_study with results and a quote", () => {
    const doc = {
      title: "Case study",
      assetType: "case_study",
      headline: "How Beta cut costs",
      challenge: "Rising spend",
      solution: "Adopted Clarwiz",
      metrics: [{ label: "Savings", value: "$1.2M" }],
      quote: { text: "Game changer.", attribution: "CFO, Beta" },
      sections: [],
    };
    const html = renderDocumentHtml(doc);
    expect(html).toContain("Rising spend");
    expect(html).toContain("$1.2M");
    expect(html).toContain("Game changer.");
    expect(html).not.toContain("<script");
  });

  it("renders an roi_doc with a payback summary", () => {
    const doc = {
      title: "ROI",
      assetType: "roi_doc",
      headline: "Your ROI",
      metrics: [{ label: "Payback", value: "6 mo" }],
      payback: { summary: "Breaks even in 6 months." },
      sections: [],
    };
    const html = renderDocumentHtml(doc);
    expect(html).toContain("6 mo");
    expect(html).toContain("Breaks even in 6 months.");
    expect(html).not.toContain("<script");
  });

  it("renders an email_template body", () => {
    const doc = {
      title: "Email",
      assetType: "email_template",
      headline: "Following up",
      sections: [{ id: "body", title: "", body: "Hi there,\n\nThanks for your time." }],
    };
    const html = renderDocumentHtml(doc);
    expect(html).toContain("Thanks for your time.");
    expect(html).not.toContain("<script");
  });

  it("falls back to one_pager layout for an unknown assetType", () => {
    const doc = { title: "X", assetType: "mystery", headline: "Hi", sections: [] };
    const html = renderDocumentHtml(doc);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("Hi");
  });
});

describe("renderDocumentHtml — robustness", () => {
  it("handles a missing/empty doc without throwing", () => {
    expect(renderDocumentHtml(null).startsWith("<!DOCTYPE html>")).toBe(true);
    expect(renderDocumentHtml({}).startsWith("<!DOCTYPE html>")).toBe(true);
    expect(renderDocumentHtml(undefined)).toContain("</html>");
  });

  it("escapes HTML in field values (no injection via headline)", () => {
    const html = renderDocumentHtml({
      title: "X",
      headline: "<script>alert(1)</script>",
      sections: [],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("tolerates non-array sections/metrics", () => {
    const html = renderDocumentHtml({ title: "X", headline: "H", sections: "nope", metrics: 5 });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("accepts an optional brand accent override", () => {
    const html = renderDocumentHtml({ title: "X", headline: "H", sections: [] }, { accent: "#0EA5E9" });
    expect(html).toContain("#0EA5E9");
  });
});

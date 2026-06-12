import { describe, it, expect } from "vitest";
import { buildGmailRawMessage, sendGmailMessage } from "./gmailSend.js";

describe("buildGmailRawMessage", () => {
  it("produces base64url-encoded RFC message", () => {
    const raw = buildGmailRawMessage({
      from: "ae@company.com",
      to: "buyer@acme.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });
    expect(raw).not.toContain("+");
    expect(raw).not.toContain("/");
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(decoded).toContain("From: ae@company.com");
    expect(decoded).toContain("To: buyer@acme.com");
    expect(decoded).toContain("<p>Hi</p>");
  });

  it("builds multipart/mixed when attachments are present", () => {
    const raw = buildGmailRawMessage({
      from: "ae@company.com",
      to: "buyer@acme.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      attachments: [{ filename: "deck.html", content: "<html><body>Deck</body></html>", mimeType: "text/html" }],
    });
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(decoded).toContain("multipart/mixed");
    expect(decoded).toContain('filename="deck.html"');
    expect(decoded).toContain("Content-Disposition: attachment");
    expect(decoded).toContain('Content-Type: text/html; charset="UTF-8"; name="deck.html"');
  });

  it("places MIME headers before the header/body separator (not in the visible body)", () => {
    const raw = buildGmailRawMessage({
      from: "ae@company.com",
      to: "buyer@acme.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      attachments: [{ filename: "deck.html", content: "<html><body>Deck</body></html>", mimeType: "text/html" }],
    });
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const headerBlock = decoded.split("\r\n\r\n")[0];
    const bodyBlock = decoded.split("\r\n\r\n").slice(1).join("\r\n\r\n");

    expect(headerBlock).toContain("MIME-Version: 1.0");
    expect(headerBlock).toContain("multipart/mixed");
    expect(bodyBlock.startsWith("--clarwiz_")).toBe(true);
    expect(bodyBlock).not.toMatch(/^MIME-Version:/m);
  });
});

describe("sendGmailMessage", () => {
  it("returns ok with message id on success", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "MSG1" }),
    });
    const res = await sendGmailMessage(
      "tok",
      { from: "a@b.com", to: "c@d.com", subject: "S", html: "<p>x</p>" },
      { fetchImpl }
    );
    expect(res.ok).toBe(true);
    expect(res.id).toBe("MSG1");
  });
});

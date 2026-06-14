import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { buildGmailRawMessage } from "@/lib/gmail/gmailSend";
import { htmlToPdfBuffer, isValidPdfBuffer } from "@/lib/assist/htmlToPdf";
import { prepareHtmlForPdf } from "@/lib/assist/prepareHtmlForPdf";

const brochurePath = join(process.cwd(), "src/lib/assist/richCollateral/html/brochure.html");

describe("htmlToPdfBuffer", () => {
  it.skipIf(!process.env.CHROME_PATH && !require("fs").existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"))(
    "produces a valid PDF from rich collateral HTML",
    async () => {
      const raw = readFileSync(brochurePath, "utf8");
      const html = prepareHtmlForPdf(raw);
      const pdf = await htmlToPdfBuffer(html);
      expect(isValidPdfBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(1000);
    },
    60_000
  );
});

describe("buildGmailRawMessage PDF attachment", () => {
  it("round-trips a PDF attachment without corruption", () => {
    const fakePdf = Buffer.from("%PDF-1.4 fake pdf content for test");
    const b64 = fakePdf.toString("base64");
    const raw = buildGmailRawMessage({
      from: "ae@company.com",
      to: "buyer@acme.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      attachments: [
        {
          filename: "deck.pdf",
          content: b64,
          mimeType: "application/pdf",
          encoding: "base64",
        },
      ],
    });
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const attachB64 = decoded.split("\r\n\r\n").slice(1).join("\r\n\r\n").match(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--clarwiz_/);
    expect(attachB64).toBeTruthy();
    const recovered = Buffer.from(attachB64[1].replace(/\r\n/g, ""), "base64");
    expect(recovered.toString("utf8")).toBe(fakePdf.toString("utf8"));
  });
});

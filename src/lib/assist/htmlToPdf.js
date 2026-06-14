import { existsSync } from "fs";
import puppeteer from "puppeteer-core";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

function resolveChromePath() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function isValidPdfBuffer(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf ?? []);
  return b.length > 4 && b.subarray(0, 4).toString("ascii") === "%PDF";
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === "string") return Buffer.from(data, "binary");
  return Buffer.from(data ?? []);
}

/**
 * Render HTML to a PDF buffer using headless Chrome (puppeteer-core).
 * Requires a local Chrome/Chromium binary (CHROME_PATH env override supported).
 */
export async function htmlToPdfBuffer(html) {
  const executablePath = resolveChromePath();
  if (!executablePath) {
    throw new Error("chrome_not_available");
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(String(html || ""), {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    // Allow web fonts / layout to settle without networkidle0 (often never fires).
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));

    const raw = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
      preferCSSPageSize: true,
    });

    const pdf = toBuffer(raw);
    if (!isValidPdfBuffer(pdf)) {
      throw new Error("pdf_generation_invalid_output");
    }
    return pdf;
  } finally {
    await browser.close();
  }
}

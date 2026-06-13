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
      waitUntil: "networkidle0",
      timeout: 45_000,
    });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16px", bottom: "16px", left: "16px", right: "16px" },
    });
  } finally {
    await browser.close();
  }
}

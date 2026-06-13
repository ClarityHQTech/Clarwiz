import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTenantProspectTokens } from "@/lib/assist/richCollateral/tenantTokens";

const HTML_DIR = join(process.cwd(), "src/lib/assist/richCollateral/html");

/** @type {Record<string, { file: string, title: string, type: string, category: string, slug: string, tags: string[] }>} */
export const RICH_TEMPLATE_CATALOG = {
  brochure: {
    file: "brochure.html",
    title: "Product Brochure",
    type: "MARKETING_DOC",
    category: "MARKETING",
    slug: "predefined-brochure",
    tags: ["brochure", "marketing", "rich", "predefined", "system"],
  },
  battlecard: {
    file: "battlecard.html",
    title: "Competitive Battlecard",
    type: "BATTLECARD",
    category: "SALES",
    slug: "predefined-battlecard",
    tags: ["battlecard", "competitive", "rich", "predefined", "system"],
  },
  sales_deck: {
    file: "sales-deck.html",
    title: "Sales Deck",
    type: "PITCH_DECK",
    category: "SALES",
    slug: "predefined-sales-deck",
    tags: ["deck", "pitch", "rich", "predefined", "system"],
  },
};

export function listRichTemplateKeys() {
  return Object.keys(RICH_TEMPLATE_CATALOG);
}

export function getRichTemplateMeta(key) {
  return RICH_TEMPLATE_CATALOG[key] ?? null;
}

export function loadRichTemplateHtml(key) {
  const meta = getRichTemplateMeta(key);
  if (!meta) throw new Error(`unknown_rich_template:${key}`);
  return readFileSync(join(HTML_DIR, meta.file), "utf8");
}

/**
 * Replace `{{token}}` placeholders. Unknown tokens become empty string.
 * Values may contain safe HTML (e.g. battlecard headline spans).
 */
export function fillRichTemplate(html, tokens = {}) {
  return String(html).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = tokens[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

/**
 * @deprecated Use buildTenantProspectTokens — kept for demo lab compatibility.
 */
export function buildFillTokens({ scenarioTokens = {}, tenant, prospect, contact, deal, brand = {}, assets = [] } = {}) {
  if (tenant) {
    return buildTenantProspectTokens({
      tenant,
      prospect: prospect || {
        name: scenarioTokens.prospect_company,
        industry: scenarioTokens.prospect_industry,
      },
      contact: contact || {
        name: scenarioTokens.champion_name,
        title: scenarioTokens.champion_title,
      },
      deal: deal || { stage: scenarioTokens.deal_stage },
      brand,
      assets,
      extra: scenarioTokens,
    });
  }
  return buildTenantProspectTokens({
    tenant: { name: scenarioTokens.seller_name || "Your Company" },
    prospect: {
      name: scenarioTokens.prospect_company || "Prospect Company",
      industry: scenarioTokens.prospect_industry,
    },
    contact: { name: scenarioTokens.champion_name, title: scenarioTokens.champion_title },
    deal: { stage: scenarioTokens.deal_stage },
    brand,
    assets,
    extra: scenarioTokens,
  });
}

export function renderRichTemplate(key, tokens = {}) {
  const raw = loadRichTemplateHtml(key);
  return fillRichTemplate(raw, tokens);
}

/**
 * Build {{token}} map from tenant DB row + prospect/deal context for rich HTML templates.
 */

function readCompanyName(companyDetails, fallback) {
  if (!companyDetails || typeof companyDetails !== "object") return fallback;
  return (
    companyDetails.company_name ||
    companyDetails.legal_name ||
    companyDetails.name ||
    fallback
  );
}

/**
 * @param {object} args
 * @param {object} [args.tenant]       { name, company_details }
 * @param {object} [args.prospect]     { name, industry, ... }
 * @param {object} [args.contact]      { name, title }
 * @param {object} [args.deal]         { stage }
 * @param {object} [args.brand]
 * @param {Array}  [args.assets]
 * @param {object} [args.extra]        additional token overrides
 */
export function buildTenantProspectTokens({
  tenant = {},
  prospect = {},
  contact = {},
  deal = {},
  brand = {},
  assets = [],
  extra = {},
} = {}) {
  const tenantName = tenant?.name?.trim() || "Your Company";
  const tenantCompany = readCompanyName(tenant?.company_details, tenantName);
  const prospectCompany = prospect?.name?.trim() || "Prospect Company";
  const industry = prospect?.industry?.trim() || "your industry";
  const champion = contact?.name?.trim() || "your champion";
  const championTitle = contact?.title?.trim() || "Executive sponsor";
  const dealStage = deal?.stage?.trim() || "Active evaluation";

  const logo = brand?.logoUrl || assets.find((a) => a.role === "logo")?.url || "";
  const hero = assets.find((a) => a.role === "hero")?.url || "";
  const tagline =
    brand?.tagline?.trim() ||
    tenant?.company_details?.tagline?.trim() ||
    `Sales intelligence for ${tenantCompany}`;

  const productDescriptor =
    tenant?.company_details?.product_description?.trim() ||
    tenant?.company_details?.value_proposition?.trim() ||
    `${tenantName} helps teams turn intelligence into pipeline.`;

  return {
    tenant_name: tenantName,
    tenant_name_upper: tenantName.toUpperCase(),
    tenant_company: tenantCompany,
    seller_name: tenantName,
    seller_tagline: tagline,
    prospect_company: prospectCompany,
    prospect_industry: industry,
    champion_name: champion,
    champion_title: championTitle,
    deal_stage: dealStage,
    logo_url: logo,
    hero_image_url: hero,
    hero_headline: `${prospectCompany} deserves a pipeline built on intelligence, not guesswork`,
    hero_subhead: `${tenantName} turns your brand intelligence into account lists worth pursuing, outreach worth replying to, and a pipeline your team can trust.`,
    battlecard_headline: `Every competitor owns a step. <span class="accent">${tenantName} owns the system for ${prospectCompany}</span>`,
    battlecard_intro: `Most teams stitch together data, enrichment, sequencing, and engagement platforms. ${tenantName} connects all four through one intelligence-driven operating model for ${prospectCompany}.`,
    deck_title: `${prospectCompany} × ${tenantName} — right accounts, right outreach`,
    deck_subtitle: `A discovery narrative for ${champion}${championTitle ? `, ${championTitle}` : ""}`,
    deck_intro: `${tenantName} finds your best-fit accounts, drafts outreach in your voice, and guides every prospect toward the next best outcome.`,
    product_descriptor: productDescriptor,
    ...extra,
  };
}

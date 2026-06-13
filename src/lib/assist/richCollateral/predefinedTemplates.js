/** Tags on CollateralIndex rows that mark system predefined templates. */
export const PREDEFINED_TAG = "predefined";
export const SYSTEM_TAG = "system";

export const LEGACY_PREDEFINED_SLUGS = [
  "rich-clarwiz-brochure",
  "rich-clarwiz-battlecard",
  "rich-clarwiz-sales-deck",
];

export function isPredefinedSlug(slug) {
  return typeof slug === "string" && slug.startsWith("predefined-");
}

export function isPredefinedCollateralRow(row) {
  if (!row) return false;
  if (Array.isArray(row.tags) && row.tags.includes(PREDEFINED_TAG)) return true;
  return isPredefinedSlug(row.slug);
}

export function isPredefinedDocument(data) {
  if (!data || typeof data !== "object") return false;
  return data.isPredefined === true || data.readOnly === true;
}

export function getSuppressedPredefinedSlugs(companyDetails) {
  const raw = companyDetails?.assist?.suppressedPredefinedSlugs;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()));
}

export function suppressPredefinedSlug(companyDetails, slug) {
  if (!slug || !isPredefinedSlug(slug)) return companyDetails ?? null;
  const base = companyDetails && typeof companyDetails === "object" ? { ...companyDetails } : {};
  const assist = base.assist && typeof base.assist === "object" ? { ...base.assist } : {};
  const prev = Array.isArray(assist.suppressedPredefinedSlugs) ? assist.suppressedPredefinedSlugs : [];
  assist.suppressedPredefinedSlugs = [...new Set([...prev, slug])];
  base.assist = assist;
  return base;
}

/** NBA + hub: skip predefined templates the tenant removed from workspace. */
export function isTemplateActiveForTenant(row, companyDetails) {
  if (!isPredefinedCollateralRow(row)) return true;
  const slug = row.slug;
  if (!slug) return true;
  return !getSuppressedPredefinedSlugs(companyDetails).has(slug);
}

export function parseCompanyDetails(companyDetails) {
  if (!companyDetails || typeof companyDetails !== "object") {
    return { industry: "", about: "", website: "" };
  }
  return {
    industry:
      typeof companyDetails.industry === "string" ? companyDetails.industry : "",
    about: typeof companyDetails.about === "string" ? companyDetails.about : "",
    website:
      typeof companyDetails.website === "string" ? companyDetails.website : "",
  };
}

export function buildCompanyDetails({ industry, about, website }) {
  const result = {};
  const trimmedIndustry = industry?.trim();
  const trimmedAbout = about?.trim();
  const trimmedWebsite = website?.trim();
  if (trimmedIndustry) result.industry = trimmedIndustry;
  if (trimmedAbout) result.about = trimmedAbout;
  if (trimmedWebsite) result.website = trimmedWebsite;
  return Object.keys(result).length ? result : null;
}

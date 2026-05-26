export function prospectFirstName(name) {
  if (!name?.trim()) return "there";
  return name.trim().split(/\s+/)[0];
}

export function applyTemplateVariables(text, { prospect, campaign }) {
  if (!text) return "";
  const firstName =
    prospect?.firstName?.trim() ||
    prospectFirstName(prospect?.name) ||
    "there";
  const painPoint =
    prospect?.painPoint?.trim() ||
    campaign?.goals?.trim() ||
    campaign?.description?.trim() ||
    "your current priorities";

  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{company\}\}/gi, prospect?.company || "your company")
    .replace(/\{\{job_title\}\}/gi, prospect?.jobTitle || "your role")
    .replace(/\{\{pain_point\}\}/gi, painPoint)
    .replace(/\{\{prospect_id\}\}/gi, prospect?.id ?? "");
}

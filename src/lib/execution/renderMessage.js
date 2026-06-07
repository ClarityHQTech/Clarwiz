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
  const lastName = prospect?.lastName?.trim() || "";
  const name = prospect?.name?.trim() || "";
  const company = prospect?.company?.trim() || "your company";
  const jobTitle = prospect?.jobTitle?.trim() || "your role";

  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{company\}\}/gi, company)
    .replace(/\{\{job_title\}\}/gi, jobTitle)
    .replace(/\{\{prospect_id\}\}/gi, prospect?.id ?? "");
}

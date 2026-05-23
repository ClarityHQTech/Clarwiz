export const CAMPAIGN_CHANNELS = ["email", "linkedin", "whatsapp"];

export const CTA_OPTIONS = [
  { value: "book_demo", label: "Book demo" },
  { value: "reply_email", label: "Reply to email" },
  { value: "connect_linkedin", label: "Connect on LinkedIn" },
  { value: "visit_website", label: "Visit website" },
];

export const CHANNEL_LABELS = {
  email: "Email",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

export { TEMPLATE_VARIABLE_LIST, TEMPLATE_VARIABLES } from "@/lib/templateVariables";

/** Excel / CSV column names recognized on prospect import (any casing). */
export const PROSPECT_IMPORT_COLUMNS = [
  "Name (or firstName + lastName)",
  "companyName / company",
  "jobTitle",
  "companyIndustry → {{pain_point}}",
  "email, phone, whatsapp",
  "linkedinUrl / linkedinPublicUrl",
];

export const MAX_TEMPLATE_STAGE = 20;

export function newTemplateId() {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createTemplate(channel, stage = 1) {
  return {
    id: newTemplateId(),
    channel,
    stage,
    subject: channel === "email" ? "" : undefined,
    body: "",
    cta:
      channel === "linkedin"
        ? "connect_linkedin"
        : channel === "email"
          ? "reply_email"
          : "reply_email",
    whatsappTemplateId: channel === "whatsapp" ? "" : undefined,
  };
}

export function validateTemplate(template) {
  const label = `${CHANNEL_LABELS[template.channel]} · Stage ${template.stage}`;

  if (!template.stage || template.stage < 1) {
    return `${label}: stage must be at least 1.`;
  }
  if (template.channel === "email" && !template.subject?.trim()) {
    return `${label}: email subject is required.`;
  }
  if (template.channel === "whatsapp" && !template.whatsappTemplateId?.trim()) {
    return `${label}: WhatsApp template ID is required.`;
  }
  if (!template.body?.trim()) {
    return `${label}: message body is required.`;
  }
  if (!CTA_OPTIONS.some((c) => c.value === template.cta)) {
    return `${label}: invalid CTA.`;
  }
  return null;
}

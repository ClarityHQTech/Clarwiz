import { newTemplateId } from "@/lib/campaignConstants";
import {
  defaultWhatsAppVariableMapping,
  parseWhatsAppTemplateVariableSlots,
} from "@/lib/whatsappTemplateVariables";

/** Stable key for a provider template (name + language). */
export function whatsAppTemplateKey(template) {
  if (!template) return "";
  const name = template.name ?? template.whatsappTemplateId ?? "";
  const lang = template.language ?? "";
  return `${name}::${lang}`;
}

/** Map a cached integration template to a draft comm template row. */
export function commTemplateFromWhatsApp(waTemplate, stage = 1) {
  const templateName = waTemplate.name?.trim();
  const body =
    waTemplate.body?.trim() ||
    waTemplate.displayName?.trim() ||
    templateName ||
    " ";

  const slots = parseWhatsAppTemplateVariableSlots(waTemplate);

  return {
    id: newTemplateId(),
    channel: "whatsapp",
    stage,
    body,
    cta: "reply_email",
    whatsappTemplateId: templateName,
    whatsappVariableMapping: defaultWhatsAppVariableMapping(waTemplate),
    whatsappBodyVariableCount: slots.bodyCount,
    whatsappHeaderVariableCount: slots.headerCount,
  };
}

/** Next stage number after existing WhatsApp comm templates. */
export function nextWhatsAppStage(existingTemplates) {
  const stages = existingTemplates
    .filter((t) => t.channel === "whatsapp")
    .map((t) => Number(t.stage) || 0);
  return stages.length > 0 ? Math.max(...stages) + 1 : 1;
}

/** Build comm templates from multi-selected provider templates. */
export function commTemplatesFromWhatsAppSelection(waTemplates, existingTemplates = []) {
  let stage = nextWhatsAppStage(existingTemplates);
  return waTemplates.map((wa) => {
    const row = commTemplateFromWhatsApp(wa, stage);
    stage += 1;
    return row;
  });
}

export function isWhatsAppTemplateAlreadyLinked(template, templates) {
  const name = template.name?.trim();
  if (!name) return false;
  return templates.some(
    (t) =>
      t.channel === "whatsapp" &&
      t.whatsappTemplateId?.trim() === name
  );
}

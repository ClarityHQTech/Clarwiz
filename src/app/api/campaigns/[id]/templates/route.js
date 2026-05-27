import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import { CAMPAIGN_CHANNELS, CTA_OPTIONS } from "@/lib/campaignConstants";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";
import {
  countWhatsAppNumberedVariables,
  normalizeWhatsAppVariableMapping,
  validateWhatsAppVariableMapping,
} from "@/lib/whatsappTemplateVariables";

const CTA_VALUES = CTA_OPTIONS.map((c) => c.value);

function validateTemplatePayload(template) {
  if (!CAMPAIGN_CHANNELS.includes(template.channel)) {
    return `Invalid channel: ${template.channel}`;
  }
  const stage = Number(template.stage);
  if (!Number.isInteger(stage) || stage < 1) {
    return "Template stage must be a positive integer";
  }
  if (!template.body?.trim()) {
    return "Message body is required";
  }
  if (!CTA_VALUES.includes(template.cta)) {
    return "Invalid CTA";
  }
  if (template.channel === "email" && !template.subject?.trim()) {
    return "Email subject is required";
  }
  if (template.channel === "whatsapp" && !template.whatsappTemplateId?.trim()) {
    return "WhatsApp template ID is required";
  }
  if (template.channel === "whatsapp") {
    const bodyCount = countWhatsAppNumberedVariables(template.body);
    const headerCount = template.whatsappHeaderVariableCount ?? 0;
    const mappingErr = validateWhatsAppVariableMapping(
      template.whatsappVariableMapping,
      {
        bodyCount,
        headerCount,
        templateName: template.whatsappTemplateId,
      }
    );
    if (mappingErr) return mappingErr;
  }
  return null;
}

function templateCreateData(campaignId, template) {
  return {
    campaignId,
    channel: template.channel,
    stage: Number(template.stage),
    subject: template.channel === "email" ? template.subject?.trim() : null,
    body: template.body.trim(),
    cta: template.cta,
    whatsappTemplateId:
      template.channel === "whatsapp" ? template.whatsappTemplateId?.trim() : null,
    whatsappVariableMapping:
      template.channel === "whatsapp"
        ? normalizeWhatsAppVariableMapping(template.whatsappVariableMapping)
        : null,
  };
}

export async function POST(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.payment) {
    return NextResponse.json(
      { error: "Forbidden", message: "You don't have access to this." },
      { status: 403 }
    );
  }

  const campaign = await getOwnedCampaignDetail(params.id, user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payloads = Array.isArray(body.templates) ? body.templates : [body];

  for (const template of payloads) {
    const err = validateTemplatePayload(template);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
  }

  await prisma.communicationTemplate.createMany({
    data: payloads.map((template) => templateCreateData(campaign.id, template)),
  });

  const serialized = await fetchSerializedCampaign(params.id, user.id);
  return NextResponse.json(serialized, { status: 201 });
}

export async function PATCH(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.payment) {
    return NextResponse.json(
      { error: "Forbidden", message: "You don't have access to this." },
      { status: 403 }
    );
  }

  const campaign = await getOwnedCampaignDetail(params.id, user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { templateId, whatsappVariableMapping } = body;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const template = campaign.templates.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (template.channel !== "whatsapp") {
    return NextResponse.json(
      { error: "Variable mapping only applies to WhatsApp templates" },
      { status: 400 }
    );
  }

  const mapping = normalizeWhatsAppVariableMapping(whatsappVariableMapping);
  const bodyCount = countWhatsAppNumberedVariables(template.body);
  const mappingErr = validateWhatsAppVariableMapping(mapping, {
    bodyCount,
    headerCount: 0,
    templateName: template.whatsappTemplateId,
  });
  if (mappingErr) {
    return NextResponse.json({ error: mappingErr }, { status: 400 });
  }

  await prisma.communicationTemplate.update({
    where: { id: templateId },
    data: { whatsappVariableMapping: mapping },
  });

  const serialized = await fetchSerializedCampaign(params.id, user.id);
  return NextResponse.json(serialized);
}

export async function DELETE(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.payment) {
    return NextResponse.json(
      { error: "Forbidden", message: "You don't have access to this." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("templateId");
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const campaign = await getOwnedCampaignDetail(params.id, user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const template = campaign.templates.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.communicationTemplate.delete({ where: { id: templateId } });

  const serialized = await fetchSerializedCampaign(params.id, user.id);
  return NextResponse.json(serialized);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import { CAMPAIGN_CHANNELS, CTA_OPTIONS } from "@/lib/campaignConstants";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";

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
  return null;
}

export async function POST(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const err = validateTemplatePayload(body);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  await prisma.communicationTemplate.create({
    data: {
      campaignId: campaign.id,
      channel: body.channel,
      stage: Number(body.stage),
      subject: body.channel === "email" ? body.subject?.trim() : null,
      body: body.body.trim(),
      cta: body.cta,
      whatsappTemplateId:
        body.channel === "whatsapp" ? body.whatsappTemplateId?.trim() : null,
    },
  });

  const serialized = await fetchSerializedCampaign(params.id, user.id);
  return NextResponse.json(serialized, { status: 201 });
}

export async function DELETE(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

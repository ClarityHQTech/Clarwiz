import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { CAMPAIGN_CHANNELS } from "@/lib/campaignConstants";
import {
  countWhatsAppNumberedVariables,
  normalizeWhatsAppVariableMapping,
  validateWhatsAppVariableMapping,
} from "@/lib/whatsappTemplateVariables";
import {
  enrollContactInCampaign,
  resolveOrCreateContact,
} from "@/lib/resolveBusinessUser";
import { computeNextOutreachAt } from "@/lib/execution/outreachSchedule";

const CTA_VALUES = ["book_demo", "reply_email", "connect_linkedin", "visit_website"];

function serializeCampaign(campaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    targetSegment: campaign.targetSegment,
    goals: campaign.goals,
    status: campaign.status,
    startDate: campaign.startDate?.toISOString() ?? null,
    prospects: campaign._count?.contactCampaigns ?? 0,
    sent: campaign.sentCount,
    openRate: campaign.openRate,
    replyRate: campaign.replyRate,
    qualifiedLeads: campaign.qualifiedLeads,
    createdAt: campaign.createdAt.toISOString(),
  };
}

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contactCampaigns: true } } },
  });

  return NextResponse.json(campaigns.map(serializeCampaign));
}

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_CREATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    name,
    description,
    targetSegment,
    goals,
    startDate,
    calendlyBookingUrl,
    prospects = [],
    templates = [],
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  if (!Array.isArray(prospects) || prospects.length === 0) {
    return NextResponse.json(
      { error: "At least one prospect is required" },
      { status: 400 }
    );
  }

  for (const p of prospects) {
    if (!p.name?.trim()) {
      return NextResponse.json({ error: "Each prospect must have a name" }, { status: 400 });
    }
  }

  if (!Array.isArray(templates)) {
    return NextResponse.json({ error: "templates must be an array" }, { status: 400 });
  }

  for (const template of templates) {
    if (!CAMPAIGN_CHANNELS.includes(template.channel)) {
      return NextResponse.json({ error: `Invalid channel: ${template.channel}` }, { status: 400 });
    }
    const stage = Number(template.stage);
    if (!Number.isInteger(stage) || stage < 1) {
      return NextResponse.json({ error: "Template stage must be a positive integer" }, { status: 400 });
    }
    if (!template.body?.trim()) {
      return NextResponse.json(
        { error: `${template.channel} stage ${stage}: message body is required` },
        { status: 400 }
      );
    }
    if (!CTA_VALUES.includes(template.cta)) {
      return NextResponse.json({ error: `Invalid CTA for ${template.channel}` }, { status: 400 });
    }
    if (template.channel === "email" && !template.subject?.trim()) {
      return NextResponse.json({ error: "Email subject is required" }, { status: 400 });
    }
    if (template.channel === "whatsapp" && !template.whatsappTemplateId?.trim()) {
      return NextResponse.json({ error: "WhatsApp template ID is required" }, { status: 400 });
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
      if (mappingErr) {
        return NextResponse.json({ error: mappingErr }, { status: 400 });
      }
    }
  }

  let parsedStartDate = null;
  if (startDate) {
    parsedStartDate = new Date(startDate);
    if (Number.isNaN(parsedStartDate.getTime())) {
      return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    }
  }

  try {
    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          tenantId: ctx.tenantId,
          name: name.trim(),
          description: description?.trim() || null,
          targetSegment: targetSegment?.trim() || null,
          goals: goals?.trim() || null,
          calendlyBookingUrl: calendlyBookingUrl?.trim() || null,
          startDate: parsedStartDate,
          status: "draft",
        },
      });

      for (const p of prospects) {
        const contact = await resolveOrCreateContact(tx, ctx.tenantId, {
          company: p.company,
          name: p.name,
          firstName: p.firstName,
          lastName: p.lastName,
          jobTitle: p.jobTitle,
          persona: p.persona,
          phone: p.phone,
          whatsapp: p.whatsapp,
          email: p.email,
          linkedinUrl: p.linkedinUrl,
          twitterId: p.twitterId,
        });

        const nextAt = computeNextOutreachAt({
          campaign: created,
          contactCampaign: { outreachDeliveryTime: null },
        });

        await enrollContactInCampaign(tx, {
          contactId: contact.id,
          campaignId: created.id,
          nextScheduledOutreachAt: nextAt,
        });
      }

      if (templates.length > 0) {
        await tx.communicationTemplate.createMany({
          data: templates.map((t) => ({
            campaignId: created.id,
            channel: t.channel,
            stage: Number(t.stage),
            subject: t.channel === "email" ? t.subject?.trim() : null,
            body: t.body.trim(),
            cta: t.cta,
            whatsappTemplateId:
              t.channel === "whatsapp" ? t.whatsappTemplateId?.trim() : null,
            whatsappVariableMapping:
              t.channel === "whatsapp"
                ? normalizeWhatsAppVariableMapping(t.whatsappVariableMapping)
                : null,
          })),
        });
      }

      return tx.campaign.findUnique({
        where: { id: created.id },
        include: { _count: { select: { contactCampaigns: true } } },
      });
    });

    return NextResponse.json(serializeCampaign(campaign), { status: 201 });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import { CAMPAIGN_CHANNELS } from "@/lib/campaignConstants";

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
    prospects: campaign._count?.prospects ?? 0,
    sent: campaign.sentCount,
    openRate: campaign.openRate,
    replyRate: campaign.replyRate,
    qualifiedLeads: campaign.qualifiedLeads,
    createdAt: campaign.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { prospects: true } } },
  });

  return NextResponse.json(campaigns.map(serializeCampaign));
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
          userId: user.id,
          name: name.trim(),
          description: description?.trim() || null,
          targetSegment: targetSegment?.trim() || null,
          goals: goals?.trim() || null,
          startDate: parsedStartDate,
          status: "draft",
        },
      });

      await tx.prospect.createMany({
        data: prospects.map((p) => ({
          campaignId: created.id,
          name: p.name.trim(),
          firstName: p.firstName?.trim() || null,
          company: p.company?.trim() || null,
          jobTitle: p.jobTitle?.trim() || null,
          painPoint: p.painPoint?.trim() || null,
          phone: p.phone?.trim() || null,
          whatsapp: p.whatsapp?.trim() || null,
          email: p.email?.trim() || null,
          linkedinUrl: p.linkedinUrl?.trim() || null,
        })),
      });

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
          })),
        });
      }

      return tx.campaign.findUnique({
        where: { id: created.id },
        include: { _count: { select: { prospects: true } } },
      });
    });

    return NextResponse.json(serializeCampaign(campaign), { status: 201 });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

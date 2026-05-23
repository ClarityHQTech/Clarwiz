import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import { CHANNEL_LABELS, CTA_OPTIONS } from "@/lib/campaignConstants";

function ctaLabel(value) {
  return CTA_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

function serializeDetail(campaign) {
  const prospectCount = campaign.prospects.length;
  const sentPercent =
    prospectCount > 0
      ? Math.min(100, Math.round((campaign.sentCount / prospectCount) * 100))
      : 0;

  const maxStage =
    campaign.templates.length > 0
      ? Math.max(...campaign.templates.map((t) => t.stage))
      : 0;

  const channelsConfigured = [
    ...new Set(campaign.templates.map((t) => t.channel)),
  ];

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    targetSegment: campaign.targetSegment,
    goals: campaign.goals,
    status: campaign.status,
    startDate: campaign.startDate?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    metrics: {
      prospectCount,
      sent: campaign.sentCount,
      openRate: campaign.openRate,
      replyRate: campaign.replyRate,
      qualifiedLeads: campaign.qualifiedLeads,
    },
    progress: {
      sentPercent,
      maxStage,
      templateCount: campaign.templates.length,
      channelsConfigured: channelsConfigured.map(
        (ch) => CHANNEL_LABELS[ch] ?? ch
      ),
    },
    templates: campaign.templates
      .sort((a, b) => a.channel.localeCompare(b.channel) || a.stage - b.stage)
      .map((t) => ({
        id: t.id,
        channel: t.channel,
        channelLabel: CHANNEL_LABELS[t.channel] ?? t.channel,
        stage: t.stage,
        subject: t.subject,
        body: t.body,
        cta: t.cta,
        ctaLabel: ctaLabel(t.cta),
        whatsappTemplateId: t.whatsappTemplateId,
      })),
    prospects: campaign.prospects.map((p) => ({
      id: p.id,
      name: p.name,
      company: p.company,
      jobTitle: p.jobTitle,
      phone: p.phone,
      whatsapp: p.whatsapp,
      email: p.email,
      linkedinUrl: p.linkedinUrl,
    })),
  };
}

async function getOwnedCampaign(id, userId) {
  return prisma.campaign.findFirst({
    where: { id, userId },
    include: {
      prospects: { orderBy: { name: "asc" } },
      templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] },
    },
  });
}

export async function GET(_request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await getOwnedCampaign(params.id, user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(serializeDetail(campaign));
}

export async function PATCH(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await getOwnedCampaign(params.id, user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "start") {
    if (campaign.prospects.length === 0) {
      return NextResponse.json(
        { error: "Add prospects before starting the drip campaign" },
        { status: 400 }
      );
    }
    if (campaign.status === "active") {
      return NextResponse.json(
        { error: "Drip campaign is already running" },
        { status: 400 }
      );
    }
    if (campaign.status === "completed") {
      return NextResponse.json(
        { error: "Cannot start a completed campaign" },
        { status: 400 }
      );
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "active",
        startDate: campaign.startDate ?? new Date(),
      },
      include: {
        prospects: { orderBy: { name: "asc" } },
        templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] },
      },
    });

    return NextResponse.json(serializeDetail(updated));
  }

  if (body.action === "pause") {
    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "Only active campaigns can be paused" },
        { status: 400 }
      );
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "paused" },
      include: {
        prospects: { orderBy: { name: "asc" } },
        templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] },
      },
    });

    return NextResponse.json(serializeDetail(updated));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

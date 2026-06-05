import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { computeCampaignMetrics } from "@/lib/campaignMetrics";

function formatActionLabel(log) {
  if (log.responseType) return "Reply received";
  if (log.status === "skipped") return "Skipped";
  return "Message planned";
}

function contactFromLog(log) {
  const bu = log.contactCampaign?.contact?.businessUser;
  return {
    name: bu?.name ?? "Contact",
    company: bu?.company?.name ?? null,
  };
}

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const logInclude = {
    campaign: { select: { id: true, name: true } },
    contactCampaign: {
      include: {
        contact: {
          include: {
            businessUser: { include: { company: true } },
          },
        },
      },
    },
  };

  const [campaigns, recentLogs, replyLogs] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId: ctx.tenantId },
      include: { commLogs: true, _count: { select: { contactCampaigns: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.communicationLog.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { sentAt: "desc" },
      take: 25,
      include: logInclude,
    }),
    prisma.communicationLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        responseType: { not: null },
      },
      orderBy: { responseAt: "desc" },
      take: 15,
      include: logInclude,
    }),
  ]);

  let totalReplies = 0;
  let totalSent = 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  for (const c of campaigns) {
    const m = computeCampaignMetrics(c.commLogs, c._count.contactCampaigns);
    totalReplies += m.replyCount;
    totalSent += m.sent;
  }

  const recentReplies = replyLogs.map((log) => {
    const contact = contactFromLog(log);
    return {
      id: log.id,
      campaignId: log.campaignId,
      campaignName: log.campaign.name,
      prospectId: log.contactCampaignId,
      prospectName: contact.name,
      company: contact.company,
      channel: log.channel,
      channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
      responseContent: log.responseContent,
      responseAt: log.responseAt?.toISOString() ?? null,
      message: log.message,
    };
  });

  const recentActions = recentLogs.map((log) => {
    const contact = contactFromLog(log);
    return {
      id: log.id,
      type: log.responseType ? "reply" : log.status === "skipped" ? "skipped" : "outbound",
      label: formatActionLabel(log),
      campaignId: log.campaignId,
      campaignName: log.campaign.name,
      prospectId: log.contactCampaignId,
      prospectName: contact.name,
      channel: log.channel,
      channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
      message: log.message,
      responseContent: log.responseContent,
      at: (log.responseAt ?? log.sentAt).toISOString(),
    };
  });

  return NextResponse.json({
    summary: {
      activeCampaigns,
      totalCampaigns: campaigns.length,
      totalReplies,
      totalSent,
    },
    recentReplies,
    recentActions,
  });
}

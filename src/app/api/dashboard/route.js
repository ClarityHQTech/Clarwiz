import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { computeCampaignMetrics } from "@/lib/campaignMetrics";

function formatActionLabel(log) {
  if (log.responseType) return "Reply received";
  if (log.status === "skipped") return "Skipped";
  return "Message planned";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [campaigns, recentLogs, replyLogs] = await Promise.all([
    prisma.campaign.findMany({
      where: { userId: user.id },
      include: { commLogs: true, _count: { select: { prospects: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.communicationLog.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: "desc" },
      take: 25,
      include: {
        prospect: { select: { id: true, name: true, company: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.communicationLog.findMany({
      where: {
        userId: user.id,
        responseType: { not: null },
      },
      orderBy: { responseAt: "desc" },
      take: 15,
      include: {
        prospect: { select: { id: true, name: true, company: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
  ]);

  let totalReplies = 0;
  let totalSent = 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  for (const c of campaigns) {
    const m = computeCampaignMetrics(c.commLogs, c._count.prospects);
    totalReplies += m.replyCount;
    totalSent += m.sent;
  }

  const recentReplies = replyLogs.map((log) => ({
    id: log.id,
    campaignId: log.campaignId,
    campaignName: log.campaign.name,
    prospectId: log.prospectId,
    prospectName: log.prospect.name,
    company: log.prospect.company,
    channel: log.channel,
    channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
    responseContent: log.responseContent,
    responseAt: log.responseAt?.toISOString() ?? null,
    message: log.message,
  }));

  const recentActions = recentLogs.map((log) => ({
    id: log.id,
    type: log.responseType ? "reply" : log.status === "skipped" ? "skipped" : "outbound",
    label: formatActionLabel(log),
    campaignId: log.campaignId,
    campaignName: log.campaign.name,
    prospectId: log.prospectId,
    prospectName: log.prospect.name,
    channel: log.channel,
    channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
    message: log.message,
    responseContent: log.responseContent,
    at: (log.responseAt ?? log.sentAt).toISOString(),
  }));

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

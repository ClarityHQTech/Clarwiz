import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { computeCampaignMetrics } from "@/lib/campaignMetrics";
import { isProspectReply } from "@/lib/commLogEngagement";
import { recentAssistActions } from "@/lib/assist/logAction";
import {
  getMofuIntegration,
  isHubspotOAuthConnected,
} from "@/lib/assist/mofuIntegration";

function formatActionLabel(log) {
  if (isProspectReply(log)) return "Reply received";
  if (log.openedAt) return "Message opened";
  if (log.status === "skipped") return "Skipped";
  return "Message planned";
}

function contactFromLog(log) {
  const bu = log.campaignContact?.contact?.businessUser;
  return {
    name: bu?.name ?? "Contact",
    company: bu?.company?.name ?? null,
  };
}

function buildAlerts({
  hubspotConnected,
  pendingCrmSync,
  pendingNbas,
  activeCampaigns,
  totalSent,
  recentSignals,
}) {
  const alerts = [];

  if (!hubspotConnected) {
    alerts.push({
      id: "hubspot-disconnected",
      type: "warning",
      title: "HubSpot not connected",
      message: "Connect HubSpot to sync qualified leads and power AE Assist.",
      href: "/integrations",
      cta: "Connect HubSpot",
    });
  }

  if (pendingCrmSync > 0) {
    alerts.push({
      id: "crm-sync-pending",
      type: "info",
      title: `${pendingCrmSync} qualified lead${pendingCrmSync === 1 ? "" : "s"} awaiting CRM sync`,
      message: "These prospects are qualified in campaigns but not yet pushed to HubSpot.",
      href: "/campaigns",
      cta: "Review campaigns",
    });
  }

  if (pendingNbas > 0) {
    alerts.push({
      id: "nba-pending",
      type: "info",
      title: `${pendingNbas} suggested next-best action${pendingNbas === 1 ? "" : "s"}`,
      message: "Your team has AI-recommended actions waiting in AE Assist.",
      href: "/assist",
      cta: "View in Assist",
    });
  }

  if (activeCampaigns > 0 && totalSent === 0) {
    alerts.push({
      id: "no-outreach",
      type: "warning",
      title: "Active campaigns with no outreach yet",
      message: "Run execution on your campaigns to start reaching prospects.",
      href: "/campaigns",
      cta: "Go to campaigns",
    });
  }

  for (const signal of recentSignals) {
    alerts.push({
      id: `signal-${signal.id}`,
      type: "signal",
      title: signal.headline,
      message: signal.dealName
        ? `Deal · ${signal.dealName}`
        : signal.accountName
          ? `Account · ${signal.accountName}`
          : "Buying signal detected",
      href: signal.dealId ? `/assist/deal/${signal.dealId}` : "/assist",
      cta: "View deal",
      score: signal.score,
      at: signal.detectedAt,
    });
  }

  return alerts.slice(0, 6);
}

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const logInclude = {
    campaign: { select: { id: true, name: true } },
    campaignContact: {
      include: {
        contact: {
          include: {
            businessUser: { include: { company: true } },
          },
        },
      },
    },
  };

  const [
    campaigns,
    recentLogs,
    replyLogs,
    funnelCounts,
    qualifiedByCampaign,
    pendingCrmSync,
    openDeals,
    assistActions,
    pendingNbas,
    recentQualified,
    recentSignals,
    mofuIntegration,
    memberCount,
    tenant,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId: ctx.tenantId },
      include: { commLogs: true, _count: { select: { campaignContacts: true } } },
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
        responseType: "reply",
        responseContent: { not: null },
      },
      orderBy: { responseAt: "desc" },
      take: 15,
      include: logInclude,
    }),
    prisma.campaignContact.groupBy({
      by: ["status"],
      where: { campaign: { tenantId: ctx.tenantId } },
      _count: { _all: true },
    }),
    prisma.campaignContact.groupBy({
      by: ["campaignId"],
      where: {
        campaign: { tenantId: ctx.tenantId },
        status: "QUALIFIED",
      },
      _count: { _all: true },
    }),
    prisma.campaignContact.count({
      where: {
        campaign: { tenantId: ctx.tenantId },
        status: "QUALIFIED",
        hubspotDealId: null,
      },
    }),
    prisma.deal.findMany({
      where: { tenantId: ctx.tenantId, status: "OPEN" },
      orderBy: { lastActivityAt: "desc" },
      take: 6,
      include: { account: { include: { company: true } } },
    }),
    recentAssistActions(prisma, ctx.tenantId, 12),
    prisma.nbaRecommendation.count({
      where: { tenantId: ctx.tenantId, status: "SUGGESTED" },
    }),
    prisma.campaignContact.findMany({
      where: {
        campaign: { tenantId: ctx.tenantId },
        status: "QUALIFIED",
      },
      orderBy: { qualifiedAt: "desc" },
      take: 6,
      include: {
        campaign: { select: { id: true, name: true } },
        contact: {
          include: {
            businessUser: { include: { company: true } },
          },
        },
      },
    }),
    prisma.signal.findMany({
      where: { tenantId: ctx.tenantId, score: { gte: 65 } },
      orderBy: { detectedAt: "desc" },
      take: 3,
      include: {
        deal: { select: { id: true, name: true } },
        account: { include: { company: { select: { name: true } } } },
      },
    }),
    getMofuIntegration(prisma, ctx.tenantId),
    prisma.tenantMembership.count({ where: { tenantId: ctx.tenantId } }),
    prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true, payment_status: true },
    }),
  ]);

  let totalReplies = 0;
  let totalSent = 0;
  let totalProspects = 0;
  let totalQualified = 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  const qualifiedMap = Object.fromEntries(
    qualifiedByCampaign.map((r) => [r.campaignId, r._count._all])
  );

  const campaignSnapshots = campaigns.slice(0, 5).map((c) => {
    const qualifiedCount = qualifiedMap[c.id] ?? 0;
    const m = computeCampaignMetrics(
      c.commLogs,
      c._count.campaignContacts,
      qualifiedCount
    );
    totalReplies += m.replyCount;
    totalSent += m.sent;
    totalProspects += c._count.campaignContacts;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      prospects: c._count.campaignContacts,
      sent: m.sent,
      openRate: Math.round(m.openRate * 10) / 10,
      replyRate: Math.round(m.replyRate * 10) / 10,
      qualifiedLeads: m.qualifiedLeads,
      updatedAt: c.updatedAt.toISOString(),
    };
  });

  const funnel = {
    pending: 0,
    inOutreach: 0,
    replied: 0,
    qualified: 0,
    other: 0,
  };

  for (const row of funnelCounts) {
    const count = row._count._all;
    if (row.status === "PENDING") funnel.pending += count;
    else if (row.status === "IN_OUTREACH") funnel.inOutreach += count;
    else if (row.status === "REPLIED") funnel.replied += count;
    else if (row.status === "QUALIFIED") {
      funnel.qualified += count;
      totalQualified += count;
    } else funnel.other += count;
  }

  const pipelineValue = openDeals.reduce((sum, d) => {
    const n = typeof d.amount === "number" ? d.amount : Number(d.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const hubspotConnected = isHubspotOAuthConnected(mofuIntegration);

  const recentReplies = replyLogs.map((log) => {
    const contact = contactFromLog(log);
    return {
      id: log.id,
      campaignId: log.campaignId,
      campaignName: log.campaign.name,
      prospectId: log.campaignContactId,
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
      type: isProspectReply(log)
        ? "reply"
        : log.openedAt
          ? "open"
          : log.status === "skipped"
            ? "skipped"
            : "outbound",
      label: formatActionLabel(log),
      campaignId: log.campaignId,
      campaignName: log.campaign.name,
      prospectId: log.campaignContactId,
      prospectName: contact.name,
      channel: log.channel,
      channelLabel: CHANNEL_LABELS[log.channel] ?? log.channel,
      message: log.message,
      responseContent: log.responseContent,
      at: (log.responseAt ?? log.sentAt)?.toISOString() ?? null,
    };
  });

  const qualifiedLeads = recentQualified.map((cc) => ({
    id: cc.id,
    campaignId: cc.campaign.id,
    campaignName: cc.campaign.name,
    name: cc.contact?.businessUser?.name ?? "Contact",
    company: cc.contact?.businessUser?.company?.name ?? null,
    qualifiedAt: cc.qualifiedAt?.toISOString() ?? null,
    crmSynced: !!cc.hubspotDealId,
    score: cc.score,
  }));

  const deals = openDeals.map((d) => ({
    id: d.id,
    name: d.name,
    amount: d.amount,
    stageLabel: d.stageLabel,
    score: d.score,
    company: d.account?.company?.name ?? null,
    lastActivityAt: d.lastActivityAt?.toISOString() ?? null,
  }));

  const signals = recentSignals.map((s) => ({
    id: s.id,
    headline: s.headline,
    score: s.score,
    dealId: s.deal?.id ?? null,
    dealName: s.deal?.name ?? null,
    accountName: s.account?.company?.name ?? null,
    detectedAt: s.detectedAt.toISOString(),
  }));

  const assistActivity = assistActions.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    hsObjectId: a.hsObjectId,
    createdAt: a.createdAt.toISOString(),
  }));

  const alerts = buildAlerts({
    hubspotConnected,
    pendingCrmSync,
    pendingNbas,
    activeCampaigns,
    totalSent,
    recentSignals: signals,
  });

  return NextResponse.json({
    tenant: {
      id: ctx.tenantId,
      name: tenant?.name ?? null,
      paymentActive: !!tenant?.payment_status,
      memberCount,
      hubspotConnected,
    },
    summary: {
      activeCampaigns,
      totalCampaigns: campaigns.length,
      totalProspects,
      totalReplies,
      totalSent,
      totalQualified,
      openDeals: openDeals.length,
      pipelineValue,
      pendingCrmSync,
      pendingNbas,
      avgOpenRate:
        campaignSnapshots.length > 0
          ? Math.round(
              (campaignSnapshots.reduce((s, c) => s + c.openRate, 0) /
                campaignSnapshots.length) *
                10
            ) / 10
          : 0,
      avgReplyRate:
        campaignSnapshots.length > 0
          ? Math.round(
              (campaignSnapshots.reduce((s, c) => s + c.replyRate, 0) /
                campaignSnapshots.length) *
                10
            ) / 10
          : 0,
    },
    funnel,
    campaigns: campaignSnapshots,
    recentReplies,
    recentActions,
    qualifiedLeads,
    deals,
    assistActivity,
    alerts,
  });
}

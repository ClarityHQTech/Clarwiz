import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { decideNextActionForProspect } from "@/lib/execution/decideNextAction";
import {
  EXECUTION_RULES_DOC,
  canPushLinkedInMessage,
  isLinkedInConnectionRequest,
} from "@/lib/execution/executionRules";
import {
  hasOutreachToday,
  planNextScheduledOutreach,
  resolveDeliveryTime,
  resolveTimezone,
  buildProspectSmartleadSchedule,
  campaignExecutionInclude,
} from "@/lib/execution/outreachSchedule";
import {
  scheduleOutreachRetry,
  storePlannedDecisionInMeta,
} from "@/lib/execution/outreachRetry";
import {
  pushEmailIfConnected,
  pushLinkedInConnectionRequest,
  pushLinkedInMessage,
  pushWhatsAppTemplateForDecision,
} from "@/lib/push";
import { getTenantIcpContextForExecution } from "@/lib/tenantIcpContext";
import { setCampaignSchedule } from "@/lib/smartleadApi";
import { ensureSmartleadCampaignForClarwiz } from "@/lib/smartleadOutreach";
import { flattenContactCampaign } from "@/lib/resolveBusinessUser";
import { TERMINAL_CONTACT_CAMPAIGN_STATUSES } from "@/lib/contactCampaignStatus";

async function loadCampaignExecutionContext(campaignId) {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    include: campaignExecutionInclude,
  });
}

function logsForContactCampaign(commLogs, contactCampaignId) {
  return commLogs.filter(
    (l) => (l.contactCampaignId ?? l.prospectId) === contactCampaignId
  );
}

function flattenCc(cc) {
  const flat = flattenContactCampaign(cc);
  flat.signals =
    cc.contact?.businessUser?.signals?.filter(
      (s) => !s.campaignId || s.campaignId === cc.campaignId
    ) ?? [];
  return flat;
}

function providerFields(decision) {
  if (!decision?.providerUsage) return {};
  return {
    modelUsed: decision.model ?? decision.modelUsed ?? null,
    providerUsage: decision.providerUsage,
    providerCost: decision.providerCost,
  };
}

async function createCommLog(data) {
  return prisma.communicationLog.create({ data });
}

async function applyPushResultToCommLog(logId, pushResult) {
  if (!pushResult || pushResult.skippedSend) {
    return {
      skippedSend: true,
      reason: pushResult?.reason ?? "integration_not_connected",
    };
  }

  const isSuccess = pushResult.status === "sent" || pushResult.status === "queued";

  await prisma.communicationLog.update({
    where: { id: logId },
    data: {
      status: pushResult.status,
      deliveryProvider: pushResult.deliveryProvider,
      deliveryMeta: pushResult.deliveryMeta,
      ...(isSuccess ? { deliveredAt: new Date() } : {}),
    },
  });

  if (!isSuccess && pushResult.status === "failed") {
    await scheduleOutreachRetry(logId, {
      error: pushResult.error ?? "send failed",
      retryCount: (await prisma.communicationLog.findUnique({ where: { id: logId } }))
        ?.retryCount,
    });
  }

  return {
    sent: pushResult.status === "sent",
    queued: pushResult.status === "queued",
    failed: pushResult.status === "failed",
    delivery: pushResult,
    error: pushResult.error ?? null,
  };
}

async function maybePushOutboundMessage({
  campaign,
  prospect,
  decision,
  commHistory,
  logId,
  useProspectSchedule = false,
}) {
  if (decision.channel === "email" && useProspectSchedule) {
    try {
      const smartleadCampaignId = await ensureSmartleadCampaignForClarwiz(campaign);
      const schedule = buildProspectSmartleadSchedule({
        timezone: resolveTimezone(campaign),
        deliveryTime: resolveDeliveryTime(prospect, campaign),
      });
      await setCampaignSchedule(smartleadCampaignId, schedule);
    } catch (err) {
      console.warn("[execution] Smartlead schedule update failed:", err.message);
    }
  }

  if (decision.channel === "email") {
    const pushResult = await pushEmailIfConnected({
      campaign,
      prospect,
      subject: decision.subject,
      message: decision.message,
      commHistory,
      useProspectSchedule,
    });
    return applyPushResultToCommLog(logId, pushResult);
  }

  if (decision.channel === "linkedin") {
    const isConnection = isLinkedInConnectionRequest(decision);
    if (!isConnection && !canPushLinkedInMessage(commHistory)) {
      return {
        skippedSend: true,
        reason: "linkedin_connection_not_accepted",
        rulesDoc: EXECUTION_RULES_DOC,
      };
    }
    const pushResult = isConnection
      ? await pushLinkedInConnectionRequest({
          tenantId: campaign.tenantId,
          prospect,
          message: decision.message,
        })
      : await pushLinkedInMessage({
          tenantId: campaign.tenantId,
          prospect,
          message: decision.message,
        });
    return applyPushResultToCommLog(logId, pushResult);
  }

  if (decision.channel === "whatsapp") {
    const pushResult = await pushWhatsAppTemplateForDecision({
      tenantId: campaign.tenantId,
      prospect,
      campaign,
      templateId: decision.templateId,
      renderedMessage: decision.message,
      commLogId: logId,
    });
    return applyPushResultToCommLog(logId, pushResult);
  }

  return null;
}

function buildResultPayload(prospect, refreshed, decision, channelDelivery) {
  return {
    prospectId: prospect.id,
    contactCampaignId: prospect.id,
    prospectName: prospect.name,
    skipped: false,
    commLogId: refreshed.id,
    channel: refreshed.channel,
    stage: refreshed.stage,
    subject: refreshed.subject,
    message: refreshed.message,
    ctaType: refreshed.ctaType,
    decisionReason: refreshed.decisionReason,
    status: refreshed.status,
    deliveryProvider: refreshed.deliveryProvider,
    deliveryMeta: refreshed.deliveryMeta,
    channelSent: channelDelivery?.sent ?? false,
    channelQueued: channelDelivery?.queued ?? false,
    channelSendSkipped: channelDelivery?.skippedSend ?? false,
    channelSendError: channelDelivery?.error ?? null,
    deliveryMessage: channelDelivery?.delivery?.deliveryMessage ?? null,
    smartleadSent:
      refreshed.channel === "email" ? (channelDelivery?.sent ?? false) : undefined,
    smartleadQueued:
      refreshed.channel === "email" ? (channelDelivery?.queued ?? false) : undefined,
    smartleadError:
      refreshed.channel === "email" ? (channelDelivery?.error ?? null) : undefined,
    model: refreshed.modelUsed,
    modelUsed: refreshed.modelUsed,
    providerUsage: refreshed.providerUsage,
    providerCost: refreshed.providerCost,
    modelTier: decision?.modelTier,
    sentAt: refreshed.sentAt.toISOString(),
    retryCount: refreshed.retryCount,
  };
}

export async function executeAndPushForProspect({
  campaign,
  prospect,
  contactCampaign,
  commHistory,
  tenantIcp,
  triggerSignalId,
  useProspectSchedule = false,
  skipDailyLimit = false,
}) {
  const flat = prospect ?? flattenCc(contactCampaign);

  if (flat.status === "QUALIFIED" || flat.qualifiedAt) {
    const skipLog = await createCommLog({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      contactCampaignId: flat.id,
      channel: "email",
      stage: null,
      message: "Contact qualified — outreach stopped",
      status: "skipped",
      decisionReason: `Qualified (${flat.qualifiedReason ?? "unknown"})`,
    });
    return {
      prospectId: flat.id,
      prospectName: flat.name,
      skipped: true,
      reason: "Contact qualified — outreach stopped",
      commLogId: skipLog.id,
    };
  }

  if (TERMINAL_CONTACT_CAMPAIGN_STATUSES.has(flat.status) && flat.status !== "QUALIFIED") {
    return {
      prospectId: flat.id,
      prospectName: flat.name,
      skipped: true,
      reason: `Contact status: ${flat.status}`,
    };
  }

  if (
    !skipDailyLimit &&
    campaign.status === "active" &&
    hasOutreachToday({ campaign, prospect: flat, commLogs: commHistory })
  ) {
    return {
      prospectId: flat.id,
      prospectName: flat.name,
      skipped: true,
      reason: "Already reached today — next outreach scheduled",
    };
  }

  const liveSignals = flat.signals ?? [];

  const decision = await decideNextActionForProspect({
    campaign,
    prospect: flat,
    templates: campaign.templates,
    commHistory,
    liveSignals,
    tenantIcp,
  });

  if (decision.skip) {
    const skipLog = await createCommLog({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      contactCampaignId: flat.id,
      channel: decision.channel || "email",
      stage: decision.stage ?? null,
      message: decision.skipReason || "No action taken",
      status: "skipped",
      decisionReason: decision.skipReason,
      signalRef: triggerSignalId ?? null,
      ...providerFields(decision),
    });
    return {
      prospectId: flat.id,
      prospectName: flat.name,
      skipped: true,
      reason: decision.skipReason,
      commLogId: skipLog.id,
    };
  }

  const log = await createCommLog({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    contactCampaignId: flat.id,
    channel: decision.channel,
    templateId: decision.templateId,
    stage: decision.stage,
    subject: decision.subject,
    message: decision.message,
    ctaType: decision.ctaType,
    status: "planned",
    decisionReason: decision.decisionReason,
    signalRef: triggerSignalId ?? decision.signalRef ?? null,
    deliveryMeta: storePlannedDecisionInMeta(decision),
    ...providerFields(decision),
  });

  const channelDelivery = await maybePushOutboundMessage({
    campaign,
    prospect: flat,
    decision,
    commHistory,
    logId: log.id,
    useProspectSchedule,
  });

  const refreshed =
    channelDelivery?.sent || channelDelivery?.queued || channelDelivery?.failed
      ? await prisma.communicationLog.findUnique({ where: { id: log.id } })
      : log;

  if (channelDelivery?.sent || channelDelivery?.queued) {
    if (campaign.status === "active" && !skipDailyLimit) {
      await planNextScheduledOutreach(flat.id, campaign);
    }
  }

  return buildResultPayload(flat, refreshed, decision, channelDelivery);
}

export async function retryCommLogPush(log) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: log.campaignId },
    include: { templates: true },
  });
  const cc = await prisma.contactCampaign.findUnique({
    where: { id: log.contactCampaignId },
    include: {
      contact: { include: { businessUser: { include: { company: true } } } },
    },
  });
  if (!campaign || !cc) {
    throw new Error("Campaign or contact not found for retry");
  }
  const prospect = flattenCc(cc);

  const planned = log.deliveryMeta?.plannedDecision;
  if (!planned) {
    throw new Error("No planned decision stored for retry");
  }

  const commHistory = await prisma.communicationLog.findMany({
    where: { campaignId: campaign.id, contactCampaignId: cc.id },
    orderBy: { sentAt: "asc" },
  });

  const decision = {
    channel: planned.channel ?? log.channel,
    templateId: planned.templateId ?? log.templateId,
    stage: planned.stage ?? log.stage,
    subject: planned.subject ?? log.subject,
    message: planned.message ?? log.message,
    ctaType: planned.ctaType ?? log.ctaType,
    decisionReason: planned.decisionReason ?? log.decisionReason,
  };

  const channelDelivery = await maybePushOutboundMessage({
    campaign,
    prospect,
    decision,
    commHistory,
    logId: log.id,
    useProspectSchedule: campaign.status === "active",
  });

  if (channelDelivery?.sent || channelDelivery?.queued) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: { status: channelDelivery.sent ? "sent" : "queued" },
    });
    if (campaign.status === "active") {
      await planNextScheduledOutreach(cc.id, campaign);
    }
  }

  return channelDelivery;
}

export async function runScheduledOutreachForProspect(campaignId, contactCampaignId) {
  const campaign = await loadCampaignExecutionContext(campaignId);
  if (!campaign || campaign.status !== "active") {
    return { skipped: true, reason: "Campaign not active" };
  }

  const cc = campaign.contactCampaigns.find((c) => c.id === contactCampaignId);
  if (!cc) return { skipped: true, reason: "Contact not found" };

  const now = new Date();
  if (cc.nextScheduledOutreachAt && cc.nextScheduledOutreachAt > now) {
    return { skipped: true, reason: "Not yet scheduled" };
  }

  const flat = flattenCc(cc);
  const commHistory = logsForContactCampaign(campaign.commLogs, cc.id);
  if (hasOutreachToday({ campaign, prospect: flat, commLogs: commHistory })) {
    return { skipped: true, reason: "Already reached today" };
  }

  const tenantIcp = await getTenantIcpContextForExecution(campaign.tenantId);

  try {
    const result = await executeAndPushForProspect({
      campaign,
      contactCampaign: cc,
      commHistory,
      tenantIcp,
      useProspectSchedule: true,
    });
    if (!result.skipped) {
      await syncCampaignMetrics(prisma, campaignId);
    }
    return result;
  } catch (err) {
    return {
      prospectId: contactCampaignId,
      skipped: true,
      error: err.message,
    };
  }
}

export async function runExecutionForCampaign(
  campaignId,
  { prospectIds, contactCampaignIds, triggerSignalId, skipDailyLimit = false, useProspectSchedule = false } = {}
) {
  const campaign = await loadCampaignExecutionContext(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const ids = contactCampaignIds ?? prospectIds;
  const targets = ids?.length
    ? campaign.contactCampaigns.filter((cc) => ids.includes(cc.id))
    : campaign.contactCampaigns;

  const tenantIcp = await getTenantIcpContextForExecution(campaign.tenantId);

  const results = [];
  let plannedCount = 0;

  for (const cc of targets) {
    const commHistory = logsForContactCampaign(campaign.commLogs, cc.id);

    try {
      const result = await executeAndPushForProspect({
        campaign,
        contactCampaign: cc,
        commHistory,
        tenantIcp,
        triggerSignalId: triggerSignalId && ids?.length === 1 ? triggerSignalId : null,
        useProspectSchedule,
        skipDailyLimit,
      });
      results.push(result);
      if (!result.skipped && result.commLogId) plannedCount += 1;
    } catch (err) {
      const flat = flattenCc(cc);
      results.push({
        prospectId: cc.id,
        prospectName: flat.name,
        skipped: true,
        error: err.message,
      });
    }
  }

  if (plannedCount > 0) {
    await syncCampaignMetrics(prisma, campaignId);
  }

  return { results, plannedCount };
}

export function serializeCommLog(log) {
  return {
    id: log.id,
    tenantId: log.tenantId,
    contactCampaignId: log.contactCampaignId,
    prospectId: log.contactCampaignId,
    channel: log.channel,
    stage: log.stage,
    subject: log.subject,
    message: log.message,
    ctaType: log.ctaType,
    status: log.status,
    sentAt: log.sentAt.toISOString(),
    openedAt: log.openedAt?.toISOString?.() ?? null,
    deliveryProvider: log.deliveryProvider ?? null,
    deliveryMeta: log.deliveryMeta ?? null,
    responseType: log.responseType,
    responseAt: log.responseAt?.toISOString() ?? null,
    responseContent: log.responseContent,
    decisionReason: log.decisionReason,
    model: log.modelUsed,
    modelUsed: log.modelUsed,
    providerUsage: log.providerUsage,
    providerCost: log.providerCost,
    templateId: log.templateId,
    signalRef: log.signalRef,
    retryCount: log.retryCount ?? 0,
    scheduledFor: log.scheduledFor?.toISOString?.() ?? null,
    nextRetryAt: log.nextRetryAt?.toISOString?.() ?? null,
  };
}

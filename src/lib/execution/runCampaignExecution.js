import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { decideNextActionForProspect } from "@/lib/execution/decideNextAction";
import {
  EXECUTION_RULES_DOC,
  canPushLinkedInMessage,
  isLinkedInConnectionRequest,
} from "@/lib/execution/executionRules";
import {
  pushEmailIfConnected,
  pushLinkedInConnectionRequest,
  pushLinkedInMessage,
  pushWhatsAppTemplateForDecision,
} from "@/lib/push";
import { getTenantIcpContextForExecution } from "@/lib/tenantIcpContext";

async function loadCampaignExecutionContext(campaignId) {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] },
      prospects: {
        orderBy: { name: "asc" },
        include: {
          signals: { orderBy: { createdAt: "asc" } },
        },
      },
      commLogs: { orderBy: { sentAt: "asc" } },
    },
  });
}

function logsForProspect(commLogs, prospectId) {
  return commLogs.filter((l) => l.prospectId === prospectId);
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

  await prisma.communicationLog.update({
    where: { id: logId },
    data: {
      status: pushResult.status,
      deliveryProvider: pushResult.deliveryProvider,
      deliveryMeta: pushResult.deliveryMeta,
      ...(pushResult.status === "sent" ? { deliveredAt: new Date() } : {}),
    },
  });

  return {
    sent: pushResult.status === "sent",
    queued: pushResult.status === "queued",
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
}) {
  if (decision.channel === "email") {
    const pushResult = await pushEmailIfConnected({
      campaign,
      prospect,
      subject: decision.subject,
      message: decision.message,
      commHistory,
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
          userId: campaign.userId,
          prospect,
          message: decision.message,
        })
      : await pushLinkedInMessage({
          userId: campaign.userId,
          prospect,
          message: decision.message,
        });
    return applyPushResultToCommLog(logId, pushResult);
  }

  if (decision.channel === "whatsapp") {
    const pushResult = await pushWhatsAppTemplateForDecision({
      userId: campaign.userId,
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

export async function runExecutionForCampaign(
  campaignId,
  { prospectIds, triggerSignalId } = {}
) {
  const campaign = await loadCampaignExecutionContext(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const targets = prospectIds?.length
    ? campaign.prospects.filter((p) => prospectIds.includes(p.id))
    : campaign.prospects;

  const tenantIcp = await getTenantIcpContextForExecution(campaign.userId);

  const results = [];
  let plannedCount = 0;

  for (const prospect of targets) {
    const commHistory = logsForProspect(campaign.commLogs, prospect.id);

    try {
      if (prospect.qualifiedAt) {
        const skipLog = await createCommLog({
          userId: campaign.userId,
          campaignId: campaign.id,
          prospectId: prospect.id,
          channel: "email",
          stage: null,
          message: "Prospect qualified — outreach stopped",
          status: "skipped",
          decisionReason: `Qualified (${prospect.qualifiedReason ?? "unknown"})`,
        });

        results.push({
          prospectId: prospect.id,
          prospectName: prospect.name,
          skipped: true,
          reason: "Prospect qualified — outreach stopped",
          commLogId: skipLog.id,
        });
        continue;
      }

      const liveSignals = prospect.signals ?? [];

      const decision = await decideNextActionForProspect({
        campaign,
        prospect,
        templates: campaign.templates,
        commHistory,
        liveSignals,
        tenantIcp,
      });

      if (decision.skip) {
        const skipLog = await createCommLog({
          userId: campaign.userId,
          campaignId: campaign.id,
          prospectId: prospect.id,
          channel: decision.channel || "email",
          stage: decision.stage ?? null,
          message: decision.skipReason || "No action taken",
          status: "skipped",
          decisionReason: decision.skipReason,
          signalRef:
            triggerSignalId && prospectIds?.length === 1
              ? triggerSignalId
              : null,
          ...providerFields(decision),
        });

        results.push({
          prospectId: prospect.id,
          prospectName: prospect.name,
          skipped: true,
          reason: decision.skipReason,
          commLogId: skipLog.id,
          model: skipLog.modelUsed,
          modelUsed: skipLog.modelUsed,
          providerUsage: skipLog.providerUsage,
          providerCost: skipLog.providerCost,
        });
        continue;
      }

      const log = await createCommLog({
        userId: campaign.userId,
        campaignId: campaign.id,
        prospectId: prospect.id,
        channel: decision.channel,
        templateId: decision.templateId,
        stage: decision.stage,
        subject: decision.subject,
        message: decision.message,
        ctaType: decision.ctaType,
        status: "planned",
        decisionReason: decision.decisionReason,
        signalRef:
          triggerSignalId && prospectIds?.length === 1
            ? triggerSignalId
            : decision.signalRef ?? null,
        ...providerFields(decision),
      });

      const channelDelivery = await maybePushOutboundMessage({
        campaign,
        prospect,
        decision,
        commHistory,
        logId: log.id,
      });

      const refreshed =
        channelDelivery?.sent || channelDelivery?.queued
          ? await prisma.communicationLog.findUnique({ where: { id: log.id } })
          : log;

      plannedCount += 1;
      results.push({
        prospectId: prospect.id,
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
        modelTier: decision.modelTier,
        sentAt: refreshed.sentAt.toISOString(),
      });
    } catch (err) {
      results.push({
        prospectId: prospect.id,
        prospectName: prospect.name,
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
    userId: log.userId,
    prospectId: log.prospectId,
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
  };
}

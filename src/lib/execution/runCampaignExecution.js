import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { decideNextActionForProspect } from "@/lib/execution/decideNextAction";
import { DEFAULT_TEST_SIGNAL } from "@/lib/execution/signals";

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

  const results = [];
  let plannedCount = 0;

  for (const prospect of targets) {
    const commHistory = logsForProspect(campaign.commLogs, prospect.id);

    try {
      const liveSignals = prospect.signals ?? [];

      const decision = await decideNextActionForProspect({
        campaign,
        prospect,
        templates: campaign.templates,
        commHistory,
        liveSignals,
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

      plannedCount += 1;
      results.push({
        prospectId: prospect.id,
        prospectName: prospect.name,
        skipped: false,
        commLogId: log.id,
        channel: log.channel,
        stage: log.stage,
        subject: log.subject,
        message: log.message,
        ctaType: log.ctaType,
        decisionReason: log.decisionReason,
        model: log.modelUsed,
        modelUsed: log.modelUsed,
        providerUsage: log.providerUsage,
        providerCost: log.providerCost,
        modelTier: decision.modelTier,
        sentAt: log.sentAt.toISOString(),
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

export async function simulateProspectReply({
  campaignId,
  prospectId,
  content,
}) {
  const latest = await prisma.communicationLog.findFirst({
    where: { campaignId, prospectId },
    orderBy: { sentAt: "desc" },
  });

  if (!latest) {
    throw new Error(
      "No communication log for this prospect — run execution first"
    );
  }

  const replyContent =
    content?.trim() ||
    "Thanks for reaching out — I'd like to learn more. Can we schedule a quick call next week?";

  const updated = await prisma.communicationLog.update({
    where: { id: latest.id },
    data: {
      responseType: "reply",
      responseAt: new Date(),
      responseContent: replyContent,
    },
  });

  await syncCampaignMetrics(prisma, campaignId);

  const execution = await runExecutionForCampaign(campaignId, {
    prospectIds: [prospectId],
  });

  return {
    replyRecordedOn: updated.id,
    replyContent,
    execution,
  };
}

export async function simulateProspectSignal({
  campaignId,
  prospectId,
  type = DEFAULT_TEST_SIGNAL.type,
  source = DEFAULT_TEST_SIGNAL.source,
  content = DEFAULT_TEST_SIGNAL.content,
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { userId: true },
  });
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, campaignId },
  });
  if (!prospect) {
    throw new Error("Prospect not found");
  }

  const signal = await prisma.prospectSignal.create({
    data: {
      userId: campaign.userId,
      campaignId,
      prospectId,
      type,
      source,
      content: content?.trim() || DEFAULT_TEST_SIGNAL.content,
    },
  });

  const execution = await runExecutionForCampaign(campaignId, {
    prospectIds: [prospectId],
    triggerSignalId: signal.id,
  });

  return {
    signal: {
      id: signal.id,
      type: signal.type,
      source: signal.source,
      content: signal.content,
      createdAt: signal.createdAt.toISOString(),
    },
    execution,
  };
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

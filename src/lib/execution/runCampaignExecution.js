import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { decideNextActionForProspect } from "@/lib/execution/decideNextAction";
import {
  EXECUTION_RULES_DOC,
  isExecutableProspectChannel,
  resolveExecutableProspectChannels,
  skipReasonForUnavailableProspectChannels,
} from "@/lib/execution/executionRules";
import { filterTemplatesByEnabledChannels } from "@/lib/campaignChannels";
import {
  hasOutreachToday,
  planNextScheduledOutreach,
  advanceNextScheduledSlot,
  resolveDeliveryTime,
  resolveDeliveryTimeLocal,
  resolveTimezone,
  buildProspectSmartleadSchedule,
  campaignExecutionInclude,
} from "@/lib/execution/outreachSchedule";
import {
  scheduleOutreachRetry,
  storePlannedDecisionInMeta,
  MAX_OUTREACH_RETRIES,
} from "@/lib/execution/outreachRetry";
import {
  pushEmailIfConnected,
  pushLinkedInConnectOrMessage,
  pushWhatsAppTemplateForDecision,
  pushWhatsAppText,
} from "@/lib/push";
import { getTenantIcpContextForExecution } from "@/lib/tenantIcpContext";
import { setCampaignSchedule } from "@/lib/smartleadApi";
import { ensureSmartleadCampaignForClarwiz } from "@/lib/smartleadOutreach";
import { flattenCampaignContact } from "@/lib/resolveBusinessUser";
import { resolveCommLogOutboundContent } from "@/lib/execution/renderCommLogContent";
import {
  hasWhatsAppProspectReply,
  resolveWhatsAppSendMode,
} from "@/lib/whatsappSessionWindow";
import { syncCampaignContactStatus } from "@/lib/syncCampaignContactStatus";
import { TERMINAL_CAMPAIGN_CONTACT_STATUSES } from "@/lib/campaignContactStatus";

async function loadCampaignExecutionContext(campaignId) {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    include: campaignExecutionInclude,
  });
}

function logsForCampaignContact(commLogs, campaignContactId) {
  return commLogs.filter(
    (l) => (l.campaignContactId ?? l.prospectId) === campaignContactId
  );
}

function flattenCc(cc) {
  const flat = flattenCampaignContact(cc);
  flat.signals =
    cc.contact?.businessUser?.signals?.filter(
      (s) => !s.campaignId || s.campaignId === cc.campaignId
    ) ?? [];
  return flat;
}

async function loadFreshCommHistory(campaignId, campaignContactId) {
  return prisma.communicationLog.findMany({
    where: { campaignId, campaignContactId },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
  });
}

async function hydrateProspectWhatsAppWindow(prospect) {
  const cc = await prisma.campaignContact.findUnique({
    where: { id: prospect.id },
    select: { whatsapp24hWindowExpiresAt: true },
  });
  if (cc?.whatsapp24hWindowExpiresAt) {
    prospect.whatsapp24hWindowExpiresAt = cc.whatsapp24hWindowExpiresAt;
  }
  return prospect;
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

async function advanceAutopilotSchedule(campaign, campaignContactId, useProspectSchedule) {
  if (campaign.status === "active" && useProspectSchedule) {
    await advanceNextScheduledSlot(campaignContactId, campaign);
  }
}

async function recordExecutionSkip({
  campaign,
  flat,
  skipReason,
  channel,
  stage = null,
  triggerSignalId = null,
  useProspectSchedule = false,
  providerMeta = {},
}) {
  const skipLog = await createCommLog({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    campaignContactId: flat.id,
    channel: channel ?? "email",
    stage,
    message: skipReason,
    status: "skipped",
    decisionReason: skipReason,
    signalRef: triggerSignalId ?? null,
    ...providerMeta,
  });
  await advanceAutopilotSchedule(campaign, flat.id, useProspectSchedule);
  return {
    prospectId: flat.id,
    prospectName: flat.name,
    skipped: true,
    reason: skipReason,
    commLogId: skipLog.id,
  };
}

async function applyPushResultToCommLog(logId, pushResult) {
  if (!pushResult || pushResult.skippedSend) {
    return {
      skippedSend: true,
      reason: pushResult?.reason ?? "integration_not_connected",
    };
  }

  const isSuccess = pushResult.status === "sent" || pushResult.status === "queued";

  const existing = await prisma.communicationLog.findUnique({
    where: { id: logId },
    select: {
      campaignContactId: true,
      retryCount: true,
      deliveryMeta: true,
      ctaType: true,
    },
  });

  const priorMeta =
    existing?.deliveryMeta && typeof existing.deliveryMeta === "object"
      ? existing.deliveryMeta
      : {};
  const pushMeta =
    pushResult.deliveryMeta && typeof pushResult.deliveryMeta === "object"
      ? pushResult.deliveryMeta
      : {};

  const mergedMeta = { ...priorMeta, ...pushMeta };
  if (isSuccess) {
    delete mergedMeta.error;
  }

  const sentAsDmFallback =
    isSuccess &&
    mergedMeta.connectionCheckFallback &&
    mergedMeta.action === "send";

  await prisma.communicationLog.update({
    where: { id: logId },
    data: {
      status: pushResult.status,
      deliveryProvider: pushResult.deliveryProvider,
      deliveryMeta: mergedMeta,
      ...(sentAsDmFallback && existing?.ctaType === "connect_linkedin"
        ? { ctaType: "reply_email" }
        : {}),
      ...(isSuccess ? { deliveredAt: new Date() } : {}),
      ...(pushResult.renderedMessage
        ? { message: pushResult.renderedMessage }
        : pushResult.deliveryMeta?.renderedMessage
          ? { message: pushResult.deliveryMeta.renderedMessage }
          : {}),
    },
  });

  if (isSuccess && existing?.campaignContactId) {
    await syncCampaignContactStatus(prisma, existing.campaignContactId);
  }

  if (!isSuccess && pushResult.status === "failed") {
    await scheduleOutreachRetry(logId, {
      error: pushResult.error ?? "send failed",
      retryCount: existing?.retryCount,
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
  forceWhatsAppFreeform = false,
}) {
  if (
    !decision?.channel ||
    !isExecutableProspectChannel(campaign, prospect, decision.channel)
  ) {
    return {
      skippedSend: true,
      reason: "channel_not_executable",
      error: skipReasonForUnavailableProspectChannels(campaign, prospect),
      rulesDoc: EXECUTION_RULES_DOC,
    };
  }

  if (decision.channel === "email" && useProspectSchedule) {
    try {
      const smartleadCampaignId = await ensureSmartleadCampaignForClarwiz(campaign);
      const schedule = buildProspectSmartleadSchedule({
        timezone: resolveTimezone(campaign),
        deliveryTime: resolveDeliveryTimeLocal(prospect, campaign),
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
    const pushResult = await pushLinkedInConnectOrMessage({
      tenantId: campaign.tenantId,
      prospect,
      connectionMessage: decision.message,
      dmMessage: decision.message,
      commHistory,
    });
    return applyPushResultToCommLog(logId, pushResult);
  }

  if (decision.channel === "whatsapp") {
    const historyForSend = await loadFreshCommHistory(
      campaign.id,
      prospect.id ?? prospect.campaignContactId
    );
    const hasReply = hasWhatsAppProspectReply(historyForSend);
    const hasMessage = Boolean(decision.message?.trim());

    // Hard rule: inbound WhatsApp activity or webhook reply trigger → text API only
    if ((forceWhatsAppFreeform || hasReply) && hasMessage) {
      const pushResult = await pushWhatsAppText({
        tenantId: campaign.tenantId,
        prospect,
        message: decision.message,
        commLogId: logId,
      });
      return applyPushResultToCommLog(logId, pushResult);
    }

    const sendMode = resolveWhatsAppSendMode({
      decision,
      prospect,
      commHistory: historyForSend,
      forceFreeform: forceWhatsAppFreeform,
    });

    if (sendMode === "freeform") {
      const pushResult = await pushWhatsAppText({
        tenantId: campaign.tenantId,
        prospect,
        message: decision.message,
        commLogId: logId,
      });
      return applyPushResultToCommLog(logId, pushResult);
    }

    if (sendMode === "template") {
      if (!decision.templateId?.trim()) {
        return applyPushResultToCommLog(logId, {
          status: "failed",
          deliveryMeta: { error: "missing_template_id", sendMode: "template" },
          error:
            "WhatsApp template id is required outside the customer service window.",
        });
      }

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

    return {
      skippedSend: true,
      reason: "whatsapp_session_closed",
      rulesDoc: EXECUTION_RULES_DOC,
    };
  }

  return null;
}

function buildResultPayload(prospect, refreshed, decision, channelDelivery) {
  return {
    prospectId: prospect.id,
    campaignContactId: prospect.id,
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
  campaignContact,
  commHistory,
  tenantIcp,
  triggerSignalId,
  useProspectSchedule = false,
  skipDailyLimit = false,
  forceWhatsAppFreeform = false,
}) {
  const flat = prospect ?? flattenCc(campaignContact);
  await hydrateProspectWhatsAppWindow(flat);

  const liveCommHistory =
    (await loadFreshCommHistory(campaign.id, flat.id)) ??
    commHistory ??
    logsForCampaignContact(campaign.commLogs, flat.id);

  if (flat.status === "QUALIFIED" || flat.qualifiedAt) {
    return recordExecutionSkip({
      campaign,
      flat,
      skipReason: "Contact qualified — outreach stopped",
      channel: null,
      useProspectSchedule,
    });
  }

  if (TERMINAL_CAMPAIGN_CONTACT_STATUSES.has(flat.status) && flat.status !== "QUALIFIED") {
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

  const executableChannels = resolveExecutableProspectChannels(campaign, flat);
  if (executableChannels.length === 0) {
    const skipReason = skipReasonForUnavailableProspectChannels(campaign, flat);
    if (
      !skipDailyLimit &&
      campaign.status === "active" &&
      hasOutreachToday({ campaign, prospect: flat, commLogs: liveCommHistory })
    ) {
      await advanceAutopilotSchedule(campaign, flat.id, useProspectSchedule);
      return {
        prospectId: flat.id,
        prospectName: flat.name,
        skipped: true,
        reason: skipReason,
      };
    }
    return recordExecutionSkip({
      campaign,
      flat,
      skipReason,
      channel: null,
      triggerSignalId,
      useProspectSchedule,
    });
  }

  const liveSignals = flat.signals ?? [];

  const decision = await decideNextActionForProspect({
    campaign,
    prospect: flat,
    templates: filterTemplatesByEnabledChannels(campaign.templates, campaign),
    commHistory: liveCommHistory,
    liveSignals,
    tenantIcp,
  });

  const postDecisionHistory = await loadFreshCommHistory(campaign.id, flat.id);
  const hasWhatsAppReply =
    forceWhatsAppFreeform || hasWhatsAppProspectReply(postDecisionHistory);

  const whatsappSendMode =
    decision.channel === "whatsapp"
      ? decision.whatsappSendMode ??
        resolveWhatsAppSendMode({
          decision,
          prospect: flat,
          commHistory: postDecisionHistory,
          forceFreeform: forceWhatsAppFreeform || hasWhatsAppReply,
        })
      : null;

  const normalizedDecision =
    decision.channel === "whatsapp" &&
    (whatsappSendMode === "freeform" || whatsappSendMode === "template")
      ? {
          ...decision,
          whatsappSendMode,
          templateId: whatsappSendMode === "freeform" ? null : decision.templateId,
        }
      : decision;

  if (
    normalizedDecision.channel === "whatsapp" &&
    whatsappSendMode === "none" &&
    !normalizedDecision.skip
  ) {
    return recordExecutionSkip({
      campaign,
      flat,
      skipReason:
        "WhatsApp customer service window is closed and no approved template is configured for this message.",
      channel: "whatsapp",
      stage: normalizedDecision.stage ?? null,
      triggerSignalId,
      useProspectSchedule,
      providerMeta: providerFields(normalizedDecision),
    });
  }

  if (normalizedDecision.skip) {
    return recordExecutionSkip({
      campaign,
      flat,
      skipReason: normalizedDecision.skipReason || "No action taken",
      channel: normalizedDecision.channel,
      stage: normalizedDecision.stage ?? null,
      triggerSignalId,
      useProspectSchedule,
      providerMeta: providerFields(normalizedDecision),
    });
  }

  if (
    !isExecutableProspectChannel(campaign, flat, normalizedDecision.channel)
  ) {
    return recordExecutionSkip({
      campaign,
      flat,
      skipReason: skipReasonForUnavailableProspectChannels(campaign, flat),
      channel: normalizedDecision.channel,
      stage: normalizedDecision.stage ?? null,
      triggerSignalId,
      useProspectSchedule,
      providerMeta: providerFields(normalizedDecision),
    });
  }

  const outbound = resolveCommLogOutboundContent({
    channel: normalizedDecision.channel,
    message: normalizedDecision.message,
    subject: normalizedDecision.subject,
    templateId:
      normalizedDecision.channel === "whatsapp" &&
      normalizedDecision.whatsappSendMode === "freeform"
        ? null
        : normalizedDecision.templateId,
    prospect: flat,
    campaign,
    templates: campaign.templates,
  });

  const log = await createCommLog({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    campaignContactId: flat.id,
    channel: normalizedDecision.channel,
    templateId:
      normalizedDecision.channel === "whatsapp" &&
      normalizedDecision.whatsappSendMode === "freeform"
        ? null
        : normalizedDecision.templateId,
    stage: normalizedDecision.stage,
    subject: outbound.subject,
    message: outbound.message,
    ctaType: normalizedDecision.ctaType,
    status: "planned",
    decisionReason: normalizedDecision.decisionReason,
    signalRef: triggerSignalId ?? normalizedDecision.signalRef ?? null,
    deliveryMeta: storePlannedDecisionInMeta({
      ...normalizedDecision,
      message: outbound.message,
      subject: outbound.subject,
    }),
    ...providerFields(normalizedDecision),
  });

  const channelDelivery = await maybePushOutboundMessage({
    campaign,
    prospect: flat,
    decision: {
      ...normalizedDecision,
      message: outbound.message,
      subject: outbound.subject,
      templateId:
        normalizedDecision.whatsappSendMode === "freeform"
          ? null
          : normalizedDecision.templateId,
    },
    commHistory: postDecisionHistory,
    logId: log.id,
    useProspectSchedule,
    forceWhatsAppFreeform: forceWhatsAppFreeform || hasWhatsAppReply,
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

  return buildResultPayload(flat, refreshed, normalizedDecision, channelDelivery);
}

export async function retryCommLogPush(log) {
  if ((log.retryCount ?? 0) >= MAX_OUTREACH_RETRIES) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        decisionReason: `Failed after ${MAX_OUTREACH_RETRIES} retries`,
      },
    });
    return { exhausted: true, retryCount: log.retryCount };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: log.campaignId },
    include: { templates: true },
  });
  const cc = await prisma.campaignContact.findUnique({
    where: { id: log.campaignContactId },
    include: {
      contact: { include: { businessUser: { include: { company: true } } } },
    },
  });
  if (!campaign || !cc) {
    throw new Error("Campaign or contact not found for retry");
  }
  const prospect = flattenCc(cc);
  await hydrateProspectWhatsAppWindow(prospect);

  const planned = log.deliveryMeta?.plannedDecision ?? {
    channel: log.channel,
    templateId: log.templateId,
    stage: log.stage,
    subject: log.subject,
    message: log.message,
    ctaType: log.ctaType,
    decisionReason: log.decisionReason,
  };

  const commHistory = await loadFreshCommHistory(campaign.id, cc.id);

  const plannedMessage = log.message ?? planned.message;
  const hasInbound = hasWhatsAppProspectReply(commHistory);
  const sendMode =
    hasInbound && plannedMessage?.trim()
      ? "freeform"
      : resolveWhatsAppSendMode({
          decision: {
            channel: planned.channel ?? log.channel,
            templateId: planned.templateId ?? log.templateId ?? null,
            whatsappSendMode: null,
            message: plannedMessage,
          },
          prospect,
          commHistory,
          forceFreeform: hasInbound,
        });

  const decision = {
    channel: planned.channel ?? log.channel,
    templateId: sendMode === "freeform" ? null : planned.templateId ?? log.templateId ?? null,
    whatsappSendMode: sendMode ?? undefined,
    stage: planned.stage ?? log.stage,
    subject: log.subject ?? planned.subject,
    message: plannedMessage,
    ctaType: planned.ctaType ?? log.ctaType,
    decisionReason: planned.decisionReason ?? log.decisionReason,
  };

  if (decision.channel === "whatsapp" && sendMode === "none") {
    throw new Error(
      "WhatsApp session closed — cannot retry without an approved template"
    );
  }

  if (!isExecutableProspectChannel(campaign, prospect, decision.channel)) {
    throw new Error(skipReasonForUnavailableProspectChannels(campaign, prospect));
  }

  const channelDelivery = await maybePushOutboundMessage({
    campaign,
    prospect,
    decision: {
      ...decision,
      templateId: sendMode === "freeform" ? null : decision.templateId,
    },
    commHistory,
    logId: log.id,
    useProspectSchedule: campaign.status === "active",
    forceWhatsAppFreeform: sendMode === "freeform",
  });

  if (channelDelivery?.sent || channelDelivery?.queued) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: { status: channelDelivery.sent ? "sent" : "queued" },
    });
    if (campaign.status === "active") {
      await planNextScheduledOutreach(cc.id, campaign);
    }
  } else if (!channelDelivery?.failed) {
    // failed pushes are already counted in applyPushResultToCommLog
    await scheduleOutreachRetry(log.id, {
      error:
        channelDelivery?.error ??
        channelDelivery?.reason ??
        "Retry send did not complete",
      retryCount: log.retryCount,
    });
  }

  return channelDelivery;
}

export async function runScheduledOutreachForProspect(
  campaignId,
  campaignContactId,
  { claimed = false } = {}
) {
  const campaign = await loadCampaignExecutionContext(campaignId);
  if (!campaign || campaign.status !== "active") {
    return { skipped: true, reason: "Campaign not active" };
  }

  const cc = campaign.campaignContacts.find((c) => c.id === campaignContactId);
  if (!cc) return { skipped: true, reason: "Contact not found" };

  const now = new Date();
  if (
    !claimed &&
    cc.nextScheduledOutreachAt &&
    cc.nextScheduledOutreachAt > now
  ) {
    return { skipped: true, reason: "Not yet scheduled" };
  }

  const flat = flattenCc(cc);
  const freshHistory =
    (await loadFreshCommHistory(campaign.id, cc.id)) ??
    logsForCampaignContact(campaign.commLogs, cc.id);
  const hasInboundReply = hasWhatsAppProspectReply(freshHistory);

  if (!hasInboundReply && hasOutreachToday({ campaign, prospect: flat, commLogs: freshHistory })) {
    if (cc.nextScheduledOutreachAt && cc.nextScheduledOutreachAt <= now) {
      await advanceNextScheduledSlot(cc.id, campaign);
    }
    return { skipped: true, reason: "Already reached today" };
  }

  const tenantIcp = await getTenantIcpContextForExecution(campaign.tenantId);

  try {
    const result = await executeAndPushForProspect({
      campaign,
      campaignContact: cc,
      commHistory: freshHistory,
      tenantIcp,
      useProspectSchedule: true,
      skipDailyLimit: hasInboundReply,
      forceWhatsAppFreeform: hasInboundReply,
    });
    if (!result.skipped) {
      await syncCampaignMetrics(prisma, campaignId);
    }
    return result;
  } catch (err) {
    return {
      prospectId: campaignContactId,
      skipped: true,
      error: err.message,
    };
  }
}

export async function runExecutionForCampaign(
  campaignId,
  {
    prospectIds,
    campaignContactIds,
    triggerSignalId,
    skipDailyLimit = false,
    useProspectSchedule = false,
    forceWhatsAppFreeform = false,
  } = {}
) {
  const campaign = await loadCampaignExecutionContext(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const ids = campaignContactIds ?? prospectIds;
  const targets = ids?.length
    ? campaign.campaignContacts.filter((cc) => ids.includes(cc.id))
    : campaign.campaignContacts;

  const tenantIcp = await getTenantIcpContextForExecution(campaign.tenantId);

  const results = [];
  let plannedCount = 0;

  for (const cc of targets) {
    const commHistory = logsForCampaignContact(campaign.commLogs, cc.id);

    try {
      const result = await executeAndPushForProspect({
        campaign,
        campaignContact: cc,
        commHistory,
        tenantIcp,
        triggerSignalId: triggerSignalId && ids?.length === 1 ? triggerSignalId : null,
        useProspectSchedule,
        skipDailyLimit,
        forceWhatsAppFreeform,
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
    campaignContactId: log.campaignContactId,
    prospectId: log.campaignContactId,
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

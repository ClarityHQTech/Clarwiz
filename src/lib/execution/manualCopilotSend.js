import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import {
  canPushLinkedInMessage,
  getLinkedInCopilotUiState,
  LINKEDIN_CONNECTION_NOTE_MAX_CHARS,
} from "@/lib/execution/executionRules";
import { applyTemplateVariables } from "@/lib/execution/renderMessage";
import { campaignExecutionInclude } from "@/lib/execution/outreachSchedule";
import { flattenCampaignContact } from "@/lib/resolveBusinessUser";
import { resolveCampaignEnabledChannels } from "@/lib/campaignChannels";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { resolveCommLogOutboundContent } from "@/lib/execution/renderCommLogContent";
import {
  pushEmailIfConnected,
  pushLinkedInConnectOrMessage,
  pushLinkedInMessage,
  pushWhatsAppTemplateForDecision,
  pushWhatsAppText,
} from "@/lib/push";
import {
  getWhatsAppCopilotUiState,
} from "@/lib/whatsappSessionWindow";
import { syncCampaignContactStatus } from "@/lib/syncCampaignContactStatus";

async function applyPushResultToCommLog(logId, pushResult) {
  if (!pushResult || pushResult.skippedSend) {
    await prisma.communicationLog.update({
      where: { id: logId },
      data: {
        status: "skipped",
        decisionReason: pushResult?.reason ?? "integration_not_connected",
      },
    });
    return {
      ok: false,
      skipped: true,
      reason: pushResult?.reason ?? "integration_not_connected",
    };
  }

  const isSuccess = pushResult.status === "sent" || pushResult.status === "queued";

  const existing = await prisma.communicationLog.findUnique({
    where: { id: logId },
    select: { deliveryMeta: true, ctaType: true },
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

  if (!isSuccess) {
    return {
      ok: false,
      error: pushResult.error ?? "Send failed",
      status: pushResult.status,
    };
  }

  const log = await prisma.communicationLog.findUnique({
    where: { id: logId },
    select: { campaignContactId: true },
  });
  if (log?.campaignContactId) {
    await syncCampaignContactStatus(prisma, log.campaignContactId);
  }

  return { ok: true, status: pushResult.status };
}

function resolveTemplate(campaign, templateId, channel) {
  if (!templateId) return null;
  return (
    campaign.templates.find(
      (t) => t.id === templateId && t.channel === channel
    ) ?? null
  );
}

function buildEmailPayload({ body, template, prospect, campaign }) {
  let subject = body.subject?.trim() ?? "";
  let message = body.message?.trim() ?? "";

  if (template) {
    if (!subject) {
      subject = applyTemplateVariables(template.subject, { prospect, campaign });
    }
    if (!message) {
      message = applyTemplateVariables(template.body, { prospect, campaign });
    }
  }

  if (!subject) throw new Error("Email subject is required");
  if (!message) throw new Error("Email message is required");

  return {
    subject,
    message,
    templateId: template?.id ?? null,
    stage: template?.stage ?? body.stage ?? null,
    ctaType: template?.cta ?? body.ctaType ?? "reply_email",
  };
}

function buildLinkedInPayload({ body, template, prospect, campaign, commHistory }) {
  const action = body.action;
  if (!action || !["connection_request", "message"].includes(action)) {
    throw new Error('LinkedIn action must be "connection_request" or "message"');
  }

  const linkedinState = getLinkedInCopilotUiState(commHistory);

  if (action === "connection_request") {
    if (!linkedinState.canSendConnection) {
      if (linkedinState.connectionAccepted) {
        throw new Error("LinkedIn connection is already accepted — send a message instead");
      }
      throw new Error("A LinkedIn connection request is already pending");
    }
    if (!prospect.linkedinUrl?.trim()) {
      throw new Error("Contact has no LinkedIn profile URL");
    }

    let message = body.message?.trim() ?? "";
    if (template && !message) {
      message = applyTemplateVariables(template.body, { prospect, campaign });
    }
    if (message.length > LINKEDIN_CONNECTION_NOTE_MAX_CHARS) {
      throw new Error(
        `Connection note must be ${LINKEDIN_CONNECTION_NOTE_MAX_CHARS} characters or fewer`
      );
    }

    return {
      message,
      templateId: template?.id ?? null,
      stage: template?.stage ?? null,
      ctaType: "connect_linkedin",
      action,
    };
  }

  if (!canPushLinkedInMessage(commHistory)) {
    throw new Error(
      "Send a LinkedIn connection request and wait for acceptance before messaging"
    );
  }

  let message = body.message?.trim() ?? "";
  if (template && !message) {
    message = applyTemplateVariables(template.body, { prospect, campaign });
  }
  if (!message) throw new Error("LinkedIn message is required");

  return {
    message,
    templateId: template?.id ?? null,
    stage: template?.stage ?? null,
    ctaType: template?.cta ?? "reply_email",
    action,
  };
}

function buildWhatsAppPayload({ body, template, prospect, campaign, commHistory }) {
  if (!prospect.whatsapp?.trim()) {
    throw new Error("Contact has no WhatsApp number");
  }

  const windowState = getWhatsAppCopilotUiState(prospect, commHistory);
  const sendMode = body.sendMode === "template" ? "template" : "freeform";

  if (sendMode === "freeform") {
    if (!windowState.canSendFreeForm) {
      throw new Error(
        "24-hour free messaging window is closed — select a WhatsApp template instead"
      );
    }
    const message = body.message?.trim();
    if (!message) {
      throw new Error("WhatsApp message is required");
    }

    const { message: resolved } = resolveCommLogOutboundContent({
      channel: "whatsapp",
      message,
      prospect,
      campaign,
    });

    return {
      message: resolved,
      templateId: null,
      stage: body.stage ?? null,
      ctaType: "reply_whatsapp",
      sendMode: "freeform",
    };
  }

  if (!template) {
    throw new Error("Select a WhatsApp template to send");
  }

  const { message } = resolveCommLogOutboundContent({
    channel: "whatsapp",
    message: template.body,
    templateId: template.id,
    prospect,
    campaign,
    templates: [template],
  });

  return {
    message,
    templateId: template.id,
    stage: template.stage,
    ctaType: template.cta,
    sendMode: "template",
  };
}

export async function manualCopilotSend({
  campaignId,
  campaignContactId,
  tenantId,
  body,
}) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    include: campaignExecutionInclude,
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const cc = campaign.campaignContacts.find((row) => row.id === campaignContactId);
  if (!cc) {
    throw new Error("Contact not found in this campaign");
  }

  const prospect = flattenCampaignContact(cc);
  const commHistory = campaign.commLogs.filter(
    (log) => log.campaignContactId === campaignContactId
  );

  const channel = body.channel;
  if (!["email", "linkedin", "whatsapp"].includes(channel)) {
    throw new Error("Invalid channel");
  }

  const enabledChannels = resolveCampaignEnabledChannels(campaign);
  if (!enabledChannels.includes(channel)) {
    throw new Error(
      `${CHANNEL_LABELS[channel] ?? channel} is not enabled for this campaign`
    );
  }

  const template = resolveTemplate(campaign, body.templateId, channel);

  let payload;
  if (channel === "email") {
    if (!prospect.email?.trim()) {
      throw new Error("Contact has no email address");
    }
    payload = buildEmailPayload({ body, template, prospect, campaign });
  } else if (channel === "linkedin") {
    payload = buildLinkedInPayload({
      body,
      template,
      prospect,
      campaign,
      commHistory,
    });
  } else {
    payload = buildWhatsAppPayload({
      body,
      template,
      prospect,
      campaign,
      commHistory,
    });
  }

  const outbound = resolveCommLogOutboundContent({
    channel,
    message: payload.message,
    subject: payload.subject,
    templateId: payload.templateId,
    prospect,
    campaign,
    templates: campaign.templates,
  });

  const log = await prisma.communicationLog.create({
    data: {
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      campaignContactId,
      channel,
      templateId: payload.templateId,
      stage: payload.stage,
      subject: channel === "email" ? outbound.subject : null,
      message: outbound.message,
      ctaType: payload.ctaType,
      status: "planned",
      decisionReason: "Manual co-pilot send",
      deliveryMeta: {
        manualCopilot: true,
        linkedinAction: payload.action ?? null,
        whatsappSendMode: payload.sendMode ?? null,
        plannedDecision: {
          channel,
          templateId: payload.templateId,
          whatsappSendMode: payload.sendMode ?? null,
          stage: payload.stage,
          subject: channel === "email" ? outbound.subject : null,
          message: outbound.message,
          ctaType: payload.ctaType,
          decisionReason: "Manual co-pilot send",
        },
      },
    },
  });

  let pushResult;
  if (channel === "email") {
    pushResult = await pushEmailIfConnected({
      campaign,
      prospect,
      subject: outbound.subject,
      message: outbound.message,
      commHistory,
      useProspectSchedule: false,
    });
  } else if (channel === "linkedin") {
    pushResult =
      payload.action === "connection_request"
        ? await pushLinkedInConnectOrMessage({
            tenantId: campaign.tenantId,
            prospect,
            connectionMessage: outbound.message,
            dmMessage: outbound.message,
            commHistory,
          })
        : await pushLinkedInMessage({
            tenantId: campaign.tenantId,
            prospect,
            message: outbound.message,
          });
  } else if (payload.sendMode === "freeform") {
    pushResult = await pushWhatsAppText({
      tenantId: campaign.tenantId,
      prospect,
      message: outbound.message,
      commLogId: log.id,
    });
  } else {
    pushResult = await pushWhatsAppTemplateForDecision({
      tenantId: campaign.tenantId,
      prospect,
      campaign,
      templateId: payload.templateId,
      commLogId: log.id,
    });
  }

  const outcome = await applyPushResultToCommLog(log.id, pushResult);

  if (outcome.ok) {
    await syncCampaignMetrics(prisma, campaign.id);
  }

  const refreshedLog = await prisma.communicationLog.findUnique({
    where: { id: log.id },
  });

  return {
    success: outcome.ok,
    skipped: outcome.skipped ?? false,
    error: outcome.error ?? outcome.reason ?? null,
    deliveryMessage: pushResult?.deliveryMessage ?? null,
    commLog: refreshedLog,
  };
}

import { getAnthropicClient } from "@/lib/anthropicClient";
import { parseJsonLoose } from "@/lib/assist/intelligence/runner";
import { CAMPAIGN_CHANNELS } from "@/lib/campaignConstants";
import {
  ACTIVE_EXECUTION_CHANNELS,
  EXECUTION_RULES_DOC,
  LINKEDIN_CONNECTION_NOTE_MAX_CHARS,
  availableProspectChannels,
  enforceChannelRules,
  enforceReplyChannelPriority,
  isLinkedInConnectionRequest,
  truncateLinkedInConnectionNote,
} from "@/lib/execution/executionRules";
import { resolveCampaignEnabledChannels } from "@/lib/campaignChannels";
import {
  appendBookingLinkIfAllowed,
  getNextOutboundStage,
} from "@/lib/execution/appendBookingLink";
import { applyTemplateVariables } from "@/lib/execution/renderMessage";
import {
  TEMPLATE_VARIABLES,
  canUseTemplateForProspect,
  getMissingProspectVariablesForTemplate,
} from "@/lib/templateVariables";
import { selectModel } from "@/lib/execution/modelRouter";
import { buildProviderMetadata } from "@/lib/execution/openaiUsage";
import { serializeBusinessUserSignals } from "@/lib/execution/signals";
import {
  finalizeOutboundMessage,
  getLatestProspectReply,
  isReplyFollowUp,
} from "@/lib/execution/humanizeOutboundMessage";
import { buildExecutionTenantContext } from "@/lib/tenantIcpContext";
import { renderWhatsAppCommLogMessage } from "@/lib/execution/renderCommLogContent";
import {
  hasWhatsAppProspectReply,
  isWhatsAppSessionWindowOpen,
  resolveWhatsAppSendMode,
  resolveWhatsAppWindowExpiresAt,
} from "@/lib/whatsappSessionWindow";

const DECISION_SCHEMA = {
  type: "object",
  properties: {
    channel: {
      type: "string",
      enum: ["email", "linkedin", "whatsapp"],
    },
    stage: { type: "integer", minimum: 1, maximum: 20 },
    templateId: { type: ["string", "null"] },
    subject: { type: ["string", "null"] },
    message: { type: "string" },
    ctaType: { type: "string" },
    decisionReason: { type: "string" },
    skip: { type: "boolean" },
    skipReason: { type: ["string", "null"] },
  },
  required: [
    "channel",
    "stage",
    "templateId",
    "subject",
    "message",
    "ctaType",
    "decisionReason",
    "skip",
    "skipReason",
  ],
  additionalProperties: false,
};

function buildTenantContext(campaign, tenantIcp) {
  return buildExecutionTenantContext(campaign, tenantIcp);
}

function trimDeliveryMetaForLlm(meta) {
  if (!meta || typeof meta !== "object") return null;
  return {
    invitationState: meta.invitationState ?? null,
    emailStatus: meta.emailStatus ?? null,
    messageStatus: meta.messageStatus ?? null,
    lastTrackedAt: meta.lastTrackedAt ?? null,
  };
}

function serializeCommHistory(logs) {
  return logs.map((l) => ({
    id: l.id,
    channel: l.channel,
    stage: l.stage,
    subject: l.subject,
    message: l.message?.slice(0, 500),
    ctaType: l.ctaType,
    status: l.status,
    sentAt: l.sentAt?.toISOString?.() ?? l.sentAt,
    deliveredAt: l.deliveredAt?.toISOString?.() ?? l.deliveredAt ?? null,
    openedAt: l.openedAt?.toISOString?.() ?? l.openedAt ?? null,
    responseType: l.responseType,
    responseContent: l.responseContent?.slice(0, 300),
    responseAt: l.responseAt?.toISOString?.() ?? l.responseAt,
    deliveryMeta: trimDeliveryMetaForLlm(l.deliveryMeta),
  }));
}

function serializeTemplates(templates) {
  return templates.map((t) => ({
    id: t.id,
    channel: t.channel,
    stage: t.stage,
    subject: t.subject,
    bodyPreview: t.body?.slice(0, 200),
    cta: t.cta,
    whatsappTemplateId: t.whatsappTemplateId,
    whatsappVariableMapping: t.whatsappVariableMapping ?? null,
  }));
}

/** @see EXECUTION_RULES_DOC */
function availableChannels(prospect, campaign) {
  return availableProspectChannels(
    prospect,
    resolveCampaignEnabledChannels(campaign)
  );
}

export async function decideNextActionForProspect({
  campaign,
  prospect,
  templates,
  commHistory,
  liveSignals = [],
  tenantIcp = null,
}) {
  const enabledChannels = resolveCampaignEnabledChannels(campaign);
  const channels = availableChannels(prospect, campaign);
  if (channels.length === 0) {
    return {
      skip: true,
      skipReason: enabledChannels.length
        ? "No contact channels available for this prospect on enabled campaign channels"
        : "No outreach channels enabled for this campaign",
      modelUsed: null,
    };
  }

  const allowedTemplates = templates.filter((t) =>
    enabledChannels.includes(t.channel)
  );

  const serializedSignals = serializeBusinessUserSignals(liveSignals);

  const { model, tier } = selectModel({
    commHistory,
    signalCount: serializedSignals.length,
    hasRecentReply: commHistory.some(
      (l) =>
        l.responseType === "reply" &&
        l.responseAt &&
        Date.now() - new Date(l.responseAt).getTime() < 7 * 24 * 60 * 60 * 1000
    ),
  });

  const latestReply = getLatestProspectReply(commHistory);
  const replyFollowUp = isReplyFollowUp(commHistory);
  const whatsappWindowExpiresAt = resolveWhatsAppWindowExpiresAt(
    { whatsapp24hWindowExpiresAt: prospect.whatsapp24hWindowExpiresAt },
    commHistory
  );
  const whatsappWindowOpen = isWhatsAppSessionWindowOpen(whatsappWindowExpiresAt);

  const signalRules =
    serializedSignals.length > 0
      ? `
LIVE SIGNAL MODE (fresh external signals detected — prioritize hyper-personalized outreach):
- Reference the signal naturally in the message (company news, LinkedIn post, job change, etc.).
- Prefer timely channels (often LinkedIn for linkedin_post signals, email for company news).
- You may set templateId to null and write custom copy that ties the signal to the campaign value prop.
- Explain in decisionReason which signal influenced the action.`
      : "";

  const replyRules = replyFollowUp
    ? `
REPLY THREAD MODE (prospect has responded — this overrides template reuse):
- Load their reply from communicationHistory.responseContent and write a direct, human response to it.
- Reference something specific they said (timing, question, objection, or interest).
- Write like a real rep on email/LinkedIn: 2–5 short sentences, conversational, no mail-merge tone.
- NEVER output placeholders: no [Your Name], [Name], {{tokens}}, or bracketed filler text.
- NEVER use empty stock closings alone ("Looking forward to our conversation", "Best regards," with nothing substantive).
- Do NOT paste stage-1 campaign templates verbatim — generate fresh copy informed by the thread.
- MUST use channel "${latestReply?.channel ?? "same as latestProspectReply"}" — reply on the channel where the prospect responded unless that channel is unavailable.
- Match tenant brand tone: ${buildTenantContext(campaign).brandTone}.`
    : "";

  const bookingRules =
    campaign.calendlyBookingUrl?.trim()
      ? `
BOOKING / QUALIFICATION CTA:
- Stage 1 outbound: do NOT include any booking URL or Calendly reference with a link.
- Stage 2+ or reply follow-up: nudge toward booking a call; prefer ctaType book_demo when appropriate.
- Never paste Calendly URLs, [Calendly link], or other booking URLs — the app appends a tracked booking link after generation on every channel.`
      : "";

  const systemPrompt = `You are Clarwiz by ClarityHQ's execution layer: a context-aware next-best-action engine for B2B outreach (see Decision Logic: load context, score channel/stage fit, generate custom copy when needed).

Given tenant context, campaign templates, communication history, and prospect profile, decide the single best next outbound message.

Rules (full spec: ${EXECUTION_RULES_DOC}):
- Active channels only: ${enabledChannels.join(", ")}. Never use "call" (deferred). Do not use any channel outside this list.
- Prefer channels the prospect has contact info for: ${channels.join(", ")}.
- Allowed campaign template channels: ${enabledChannels.join(", ")}.
- LinkedIn: send connection request (cta connect_linkedin) before any DM; DMs only after the request is accepted (see history responseType connected).
- LinkedIn connection note (connect_linkedin message): max ${LINKEDIN_CONNECTION_NOTE_MAX_CHARS} characters including spaces — LinkedIn rejects longer notes (Linkup CUSTOM_MESSAGE_TOO_LONG). Keep it short and punchy.
- For whatsapp cold/initial outreach (no prospect WhatsApp reply in communicationHistory): you MUST set templateId to one of the campaign whatsapp template ids from templates (channel=whatsapp). Never invent template ids. Free-form whatsapp text is not allowed until the prospect has replied on WhatsApp.
- For whatsapp after a prospect WhatsApp reply (communicationHistory shows whatsapp inbound/reply): you MAY set templateId to null and write a free-form reply (recommended). You may also reuse a campaign template if appropriate.
- If no whatsapp templates exist and the prospect has not replied on WhatsApp, set skip=true with skipReason explaining missing templates.
- Email/LinkedIn template variables: ${TEMPLATE_VARIABLES}. Do not use {{pain_point}}.
- Use templateId for email/LinkedIn only when every variable referenced in that template body (and email subject, if any) is populated on the prospect profile in the user payload. If any field is null or empty, set templateId to null and write fully custom copy in message (no unfilled {{tokens}}).
- Do not repeat the same channel+stage combination already sent unless a reply warrants a follow-up.
- If the prospect replied positively (demo interest, meeting), you may set skip=true only when no outbound is needed; otherwise send a concise human reply advancing the conversation.
- If history shows exhaustion of sequence with no reply, set skip=true.
- Personalize message body using prospect and tenant context — never generic brochure copy.
- When tenantContext.icp is present, align messaging with the ICP workbook, value proposition, and persona definitions.
- All message text must be send-ready: no placeholders, no instructions to the user, no signature templates.
${replyRules}
${signalRules}
${bookingRules}
- Output valid JSON matching this schema only: ${JSON.stringify(DECISION_SCHEMA)}`;

  const userPayload = {
    tenantContext: {
      ...buildTenantContext(campaign, tenantIcp),
      bookingLinkConfigured: Boolean(campaign.calendlyBookingUrl?.trim()),
      nextOutboundStage: getNextOutboundStage(commHistory),
    },
    prospect: {
      id: prospect.id,
      name: prospect.name,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      company: prospect.company,
      jobTitle: prospect.jobTitle,
      email: prospect.email,
      phone: prospect.phone,
      whatsapp: prospect.whatsapp,
      linkedinUrl: prospect.linkedinUrl,
      availableChannels: channels,
    },
    templates: serializeTemplates(allowedTemplates),
    communicationHistory: serializeCommHistory(commHistory),
    liveSignals: serializedSignals,
    latestProspectReply: latestReply
      ? {
          content: latestReply.responseContent,
          channel: latestReply.channel,
          responseType: latestReply.responseType,
          receivedAt: latestReply.responseAt?.toISOString?.() ?? latestReply.responseAt,
        }
      : null,
    whatsappCustomerServiceWindow: {
      open: whatsappWindowOpen,
      expiresAt:
        whatsappWindowExpiresAt instanceof Date
          ? whatsappWindowExpiresAt.toISOString()
          : whatsappWindowExpiresAt ?? null,
    },
    instruction: replyFollowUp
      ? "The prospect replied. Your message field must be a natural human reply to latestProspectReply — not a cold template. Set templateId to null."
      : serializedSignals.length > 0
        ? "A live signal was detected. Return the next best action that incorporates the signal; custom copy is encouraged. Set templateId null if templates would feel generic."
        : "Return the next best outbound action. Use templateId only when the chosen email/LinkedIn template's variables are all present on the prospect; otherwise null with custom message.",
  };

  const client = getAnthropicClient();
  const completion = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: replyFollowUp ? 0.65 : serializedSignals.length > 0 ? 0.55 : 0.4,
    system: systemPrompt,
    messages: [
      { role: "user", content: JSON.stringify(userPayload, null, 2) },
    ],
  });

  const raw =
    completion.content?.find((b) => b.type === "text")?.text ?? "";
  const providerMeta = buildProviderMetadata(completion, model);

  const decision = parseJsonLoose(raw);
  if (!decision) {
    throw new Error("Execution layer returned invalid JSON");
  }

  if (decision.skip) {
    return {
      skip: true,
      skipReason: decision.skipReason || decision.decisionReason,
      modelUsed: model,
      modelTier: tier,
      channel: decision.channel,
      stage: decision.stage,
      ...providerMeta,
    };
  }

  const whatsappTemplates = allowedTemplates.filter((t) => t.channel === "whatsapp");
  const hasWhatsAppInbound = hasWhatsAppProspectReply(commHistory);

  let matchedTemplate = decision.templateId
    ? allowedTemplates.find((t) => t.id === decision.templateId)
    : null;

  if (decision.channel === "whatsapp") {
    if (whatsappTemplates.length === 0 && !hasWhatsAppInbound) {
      return {
        skip: true,
        skipReason: "No WhatsApp templates configured for this campaign",
        modelUsed: model,
        modelTier: tier,
        channel: "whatsapp",
        stage: decision.stage,
        ...providerMeta,
      };
    }
    if (
      matchedTemplate &&
      matchedTemplate.channel !== "whatsapp"
    ) {
      matchedTemplate = null;
    }
    if (!matchedTemplate && decision.templateId) {
      matchedTemplate =
        whatsappTemplates.find((t) => t.id === decision.templateId) ?? null;
    }
    if (!matchedTemplate && !hasWhatsAppInbound) {
      const byStage = whatsappTemplates.find(
        (t) => t.stage === (decision.stage ?? 1)
      );
      matchedTemplate = byStage ?? whatsappTemplates[0] ?? null;
    }
    if (
      !matchedTemplate &&
      !hasWhatsAppInbound &&
      !decision.message?.trim()
    ) {
      matchedTemplate = whatsappTemplates[0] ?? null;
    }
  }

  let message = decision.message;
  let subject = decision.subject ?? matchedTemplate?.subject ?? null;
  let ctaType = decision.ctaType || matchedTemplate?.cta;
  let stage = decision.stage ?? matchedTemplate?.stage ?? 1;
  let channel = decision.channel;
  let decisionReason = decision.decisionReason;

  if (
    matchedTemplate &&
    !replyFollowUp &&
    matchedTemplate.channel !== "whatsapp" &&
    !canUseTemplateForProspect(matchedTemplate, prospect)
  ) {
    const missing = getMissingProspectVariablesForTemplate(
      matchedTemplate,
      prospect
    );
    decisionReason = `${decisionReason} (Template ${matchedTemplate.id} skipped — missing prospect fields: ${missing.map((k) => `{{${k}}}`).join(", ")})`;
    matchedTemplate = null;
  }

  if (
    matchedTemplate &&
    !replyFollowUp &&
    !channels.includes(matchedTemplate.channel)
  ) {
    matchedTemplate = null;
  }

  if (matchedTemplate && !replyFollowUp) {
    if (matchedTemplate.channel === "whatsapp") {
      message =
        renderWhatsAppCommLogMessage({
          storedRow: matchedTemplate,
          prospect,
          campaign,
        }) ??
        matchedTemplate.whatsappTemplateId ??
        message;
    } else {
      message = applyTemplateVariables(matchedTemplate.body, { prospect, campaign });
      if (matchedTemplate.channel === "email" && matchedTemplate.subject) {
        subject = applyTemplateVariables(matchedTemplate.subject, {
          prospect,
          campaign,
        });
      }
    }
    channel = matchedTemplate.channel;
    stage = matchedTemplate.stage;
    ctaType = matchedTemplate.cta;
  } else {
    message = applyTemplateVariables(message, { prospect, campaign });
    if (subject) {
      subject = applyTemplateVariables(subject, { prospect, campaign });
    }
  }

  message = finalizeOutboundMessage({
    message,
    prospect,
    campaign,
    isReplyFollowUp: replyFollowUp,
    latestReply,
  });

  if (subject) {
    subject = finalizeOutboundMessage({
      message: subject,
      prospect,
      campaign,
      isReplyFollowUp: replyFollowUp,
      latestReply,
    });
  }

  if (
    channel === "linkedin" &&
    (ctaType === "connect_linkedin" || isLinkedInConnectionRequest({ channel, ctaType }))
  ) {
    message = truncateLinkedInConnectionNote(message) ?? message;
  }

  let decisionPayload = {
    skip: false,
    channel,
    stage,
    templateId: replyFollowUp || !matchedTemplate ? null : matchedTemplate.id,
    subject,
    message,
    ctaType,
    decisionReason,
    modelUsed: model,
    modelTier: tier,
    ...providerMeta,
  };

  decisionPayload = enforceReplyChannelPriority(
    decisionPayload,
    commHistory,
    channels
  );

  decisionPayload.message = appendBookingLinkIfAllowed({
    message: decisionPayload.message,
    campaign,
    prospectId: prospect.id,
    stage: decisionPayload.stage,
    isReplyFollowUp: replyFollowUp,
  });

  const enforced = enforceChannelRules(
    decisionPayload,
    channels,
    commHistory,
    enabledChannels
  );

  if (enforced.skip) {
    return enforced;
  }

  if (enforced.channel === "whatsapp") {
    if (hasWhatsAppProspectReply(commHistory) && enforced.message?.trim()) {
      return {
        ...enforced,
        skip: false,
        templateId: null,
        whatsappSendMode: "freeform",
      };
    }

    const sendMode = resolveWhatsAppSendMode({
      decision: enforced,
      prospect,
      commHistory,
    });

    if (sendMode === "freeform") {
      return {
        ...enforced,
        skip: false,
        templateId: null,
        whatsappSendMode: "freeform",
      };
    }

    if (sendMode === "template") {
      return {
        ...enforced,
        skip: false,
        whatsappSendMode: "template",
      };
    }

    return {
      ...enforced,
      skip: true,
      skipReason:
        "WhatsApp customer service window is closed and no approved template is configured for this message.",
    };
  }

  return { ...enforced, skip: false };
}

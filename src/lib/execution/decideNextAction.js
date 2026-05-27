import { getOpenAIClient } from "@/lib/openaiClient";
import { CAMPAIGN_CHANNELS } from "@/lib/campaignConstants";
import {
  ACTIVE_EXECUTION_CHANNELS,
  EXECUTION_RULES_DOC,
  LINKEDIN_CONNECTION_NOTE_MAX_CHARS,
  availableProspectChannels,
  enforceChannelRules,
  isLinkedInConnectionRequest,
  truncateLinkedInConnectionNote,
} from "@/lib/execution/executionRules";
import { applyTemplateVariables } from "@/lib/execution/renderMessage";
import { selectModel } from "@/lib/execution/modelRouter";
import { buildProviderMetadata } from "@/lib/execution/openaiUsage";
import { serializeProspectSignals } from "@/lib/execution/signals";
import {
  finalizeOutboundMessage,
  getLatestProspectReply,
  isReplyFollowUp,
} from "@/lib/execution/humanizeOutboundMessage";
import { buildExecutionTenantContext } from "@/lib/tenantIcpContext";

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
function availableChannels(prospect) {
  return availableProspectChannels(prospect);
}

export async function decideNextActionForProspect({
  campaign,
  prospect,
  templates,
  commHistory,
  liveSignals = [],
  tenantIcp = null,
}) {
  const channels = availableChannels(prospect);
  if (channels.length === 0) {
    return {
      skip: true,
      skipReason: "No contact channels available for this prospect",
      modelUsed: null,
    };
  }

  const serializedSignals = serializeProspectSignals(liveSignals);

  const { model, tier } = selectModel({
    commHistory,
    signalCount: serializedSignals.length,
    hasRecentReply: commHistory.some(
      (l) =>
        l.responseType &&
        l.responseAt &&
        Date.now() - new Date(l.responseAt).getTime() < 7 * 24 * 60 * 60 * 1000
    ),
  });

  const latestReply = getLatestProspectReply(commHistory);
  const replyFollowUp = isReplyFollowUp(commHistory);

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
- Match tenant brand tone: ${buildTenantContext(campaign).brandTone}.`
    : "";

  const systemPrompt = `You are ClarWiz's execution layer: a context-aware next-best-action engine for B2B outreach (see Decision Logic: load context, score channel/stage fit, generate custom copy when needed).

Given tenant context, campaign templates, communication history, and prospect profile, decide the single best next outbound message.

Rules (full spec: ${EXECUTION_RULES_DOC}):
- Active channels only: ${ACTIVE_EXECUTION_CHANNELS.join(", ")}. Never use "call" (deferred).
- Prefer channels the prospect has contact info for: ${channels.join(", ")}.
- Allowed campaign template channels: ${CAMPAIGN_CHANNELS.join(", ")}.
- LinkedIn: send connection request (cta connect_linkedin) before any DM; DMs only after the request is accepted (see history responseType connected).
- LinkedIn connection note (connect_linkedin message): max ${LINKEDIN_CONNECTION_NOTE_MAX_CHARS} characters including spaces — LinkedIn rejects longer notes (Linkup CUSTOM_MESSAGE_TOO_LONG). Keep it short and punchy.
- For whatsapp: you MUST set templateId to one of the campaign whatsapp template ids from templates (channel=whatsapp). Never invent template ids. If no whatsapp templates exist, set skip=true with skipReason explaining missing templates.
- Do not repeat the same channel+stage combination already sent unless a reply warrants a follow-up.
- If the prospect replied positively (demo interest, meeting), you may set skip=true only when no outbound is needed; otherwise send a concise human reply advancing the conversation.
- If history shows exhaustion of sequence with no reply, set skip=true.
- Personalize message body using prospect and tenant context — never generic brochure copy.
- When tenantContext.icp is present, align messaging with the ICP workbook, value proposition, and persona definitions.
- All message text must be send-ready: no placeholders, no instructions to the user, no signature templates.
${replyRules}
${signalRules}
- Output valid JSON matching the schema only.`;

  const userPayload = {
    tenantContext: buildTenantContext(campaign, tenantIcp),
    prospect: {
      id: prospect.id,
      name: prospect.name,
      firstName: prospect.firstName,
      company: prospect.company,
      jobTitle: prospect.jobTitle,
      painPoint: prospect.painPoint,
      email: prospect.email,
      phone: prospect.phone,
      whatsapp: prospect.whatsapp,
      linkedinUrl: prospect.linkedinUrl,
      availableChannels: channels,
    },
    templates: serializeTemplates(templates),
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
    instruction: replyFollowUp
      ? "The prospect replied. Your message field must be a natural human reply to latestProspectReply — not a cold template. Set templateId to null."
      : serializedSignals.length > 0
        ? "A live signal was detected. Return the next best action that incorporates the signal; custom copy is encouraged. Set templateId null if templates would feel generic."
        : "Return the next best outbound action. Use templateId when using a campaign template, else null for fully custom.",
  };

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model,
    temperature: replyFollowUp ? 0.65 : serializedSignals.length > 0 ? 0.55 : 0.4,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "next_best_action",
        strict: true,
        schema: DECISION_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload, null, 2) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  const providerMeta = buildProviderMetadata(completion, model);

  let decision;
  try {
    decision = JSON.parse(raw);
  } catch {
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

  const whatsappTemplates = templates.filter((t) => t.channel === "whatsapp");

  let matchedTemplate = decision.templateId
    ? templates.find((t) => t.id === decision.templateId)
    : null;

  if (decision.channel === "whatsapp") {
    if (whatsappTemplates.length === 0) {
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
    if (!matchedTemplate && !replyFollowUp) {
      const byStage = whatsappTemplates.find(
        (t) => t.stage === (decision.stage ?? 1)
      );
      matchedTemplate = byStage ?? whatsappTemplates[0];
    }
  }

  let message = decision.message;
  let subject = decision.subject ?? matchedTemplate?.subject ?? null;
  let ctaType = decision.ctaType || matchedTemplate?.cta;
  let stage = decision.stage ?? matchedTemplate?.stage ?? 1;
  let channel = decision.channel;

  if (matchedTemplate && !replyFollowUp) {
    message = applyTemplateVariables(matchedTemplate.body, { prospect, campaign });
    if (matchedTemplate.channel === "email" && matchedTemplate.subject) {
      subject = applyTemplateVariables(matchedTemplate.subject, {
        prospect,
        campaign,
      });
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

  const enforced = enforceChannelRules(
    {
      skip: false,
      channel,
      stage,
      templateId: replyFollowUp ? null : matchedTemplate?.id ?? decision.templateId,
      subject,
      message,
      ctaType,
      decisionReason: decision.decisionReason,
      modelUsed: model,
      modelTier: tier,
      ...providerMeta,
    },
    channels,
    commHistory
  );

  if (enforced.skip) {
    return enforced;
  }

  return { ...enforced, skip: false };
}

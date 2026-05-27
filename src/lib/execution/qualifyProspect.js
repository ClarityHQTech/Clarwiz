import { getOpenAIClient } from "@/lib/openaiClient";
import { getLatestProspectReply } from "@/lib/execution/humanizeOutboundMessage";

export const QUALIFICATION_REASONS = {
  CALENDLY_BOOKED: "calendly_booked",
  CALENDLY_LINK_CLICKED: "calendly_link_clicked",
  POSITIVE_REPLY: "positive_reply",
  MANUAL: "manual",
};

const POSITIVE_KEYWORDS =
  /\b(book|schedule|demo|call|meeting|interested|let'?s talk|sounds good|send contract|deal)\b/i;

const NEGATIVE_KEYWORDS =
  /\b(unsubscribe|not interested|wrong person|stop emailing|remove me|no thanks)\b/i;

/**
 * Idempotent — sets qualifiedAt once per prospect.
 */
export async function markProspectQualified(
  prismaClient,
  { prospectId, campaignId, reason, sourceMeta = null }
) {
  const prospect = await prismaClient.prospect.findFirst({
    where: { id: prospectId, campaignId },
  });
  if (!prospect) return { updated: false, prospect: null };
  if (prospect.qualifiedAt) {
    return { updated: false, prospect, alreadyQualified: true };
  }

  const campaign = await prismaClient.campaign.findUnique({
    where: { id: campaignId },
    select: { userId: true },
  });

  const updated = await prismaClient.prospect.update({
    where: { id: prospectId },
    data: {
      qualifiedAt: new Date(),
      qualifiedReason: reason,
    },
  });

  if (sourceMeta && campaign?.userId) {
    await prismaClient.prospectSignal
      .create({
        data: {
          userId: campaign.userId,
          campaignId,
          prospectId,
          type: "qualification",
          source: reason,
          content: JSON.stringify(sourceMeta).slice(0, 2000),
        },
      })
      .catch(() => {});
  }

  return { updated: true, prospect: updated };
}

function keywordQualificationHint(text) {
  if (!text?.trim()) return null;
  if (NEGATIVE_KEYWORDS.test(text)) return { qualified: false };
  if (POSITIVE_KEYWORDS.test(text)) return { qualified: true };
  return null;
}

/**
 * LLM classification of latest prospect reply (after track).
 */
export async function evaluateProspectQualification(
  prismaClient,
  { prospect, commHistory, campaign }
) {
  if (prospect.qualifiedAt) {
    return { qualified: false, skipped: true, reason: "already_qualified" };
  }

  const latestReply = getLatestProspectReply(commHistory);
  if (!latestReply?.responseContent?.trim()) {
    return { qualified: false, skipped: true, reason: "no_reply" };
  }

  const text = latestReply.responseContent.trim();
  const keywordHint = keywordQualificationHint(text);
  if (keywordHint?.qualified === false) {
    return { qualified: false, reason: "negative_intent_keywords" };
  }
  if (keywordHint?.qualified === true) {
    await markProspectQualified(prismaClient, {
      prospectId: prospect.id,
      campaignId: campaign.id,
      reason: QUALIFICATION_REASONS.POSITIVE_REPLY,
      sourceMeta: { channel: latestReply.channel, keywordMatch: true },
    });
    return { qualified: true, reason: QUALIFICATION_REASONS.POSITIVE_REPLY };
  }

  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL_SIMPLE?.trim() || "gpt-4o-mini";

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "qualification_check",
        strict: true,
        schema: {
          type: "object",
          properties: {
            qualified: { type: "boolean" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            reason: { type: "string" },
          },
          required: ["qualified", "confidence", "reason"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "system",
        content: `You classify B2B prospect replies for lead qualification.
Qualified = clear intent to book a demo, schedule a call, move deal forward, or explicit buying interest.
NOT qualified = OOO, polite brush-off, questions only, unsubscribe, wrong person, generic "thanks".`,
      },
      {
        role: "user",
        content: JSON.stringify({
          campaignGoals: campaign.goals,
          replyChannel: latestReply.channel,
          replyText: text.slice(0, 1500),
        }),
      },
    ],
  });

  let parsed;
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return { qualified: false, reason: "parse_error" };
  }

  if (parsed.qualified && parsed.confidence === "high") {
    await markProspectQualified(prismaClient, {
      prospectId: prospect.id,
      campaignId: campaign.id,
      reason: QUALIFICATION_REASONS.POSITIVE_REPLY,
      sourceMeta: {
        channel: latestReply.channel,
        llmReason: parsed.reason,
      },
    });
    return {
      qualified: true,
      reason: QUALIFICATION_REASONS.POSITIVE_REPLY,
      llmReason: parsed.reason,
    };
  }

  return {
    qualified: false,
    reason: parsed.reason ?? "not_qualified",
    confidence: parsed.confidence,
  };
}

/**
 * Run qualification for prospects after tracking.
 */
export async function runPostTrackQualification(
  prismaClient,
  campaignId,
  { prospectIds = [] } = {}
) {
  const campaign = await prismaClient.campaign.findUnique({
    where: { id: campaignId },
    include: {
      prospects: prospectIds.length
        ? { where: { id: { in: prospectIds }, qualifiedAt: null } }
        : { where: { qualifiedAt: null } },
      commLogs: { orderBy: { sentAt: "asc" } },
    },
  });
  if (!campaign) return [];

  const results = [];
  const logsByProspect = new Map();
  for (const log of campaign.commLogs) {
    const list = logsByProspect.get(log.prospectId) ?? [];
    list.push(log);
    logsByProspect.set(log.prospectId, list);
  }

  for (const prospect of campaign.prospects) {
    const commHistory = logsByProspect.get(prospect.id) ?? [];
    if (!commHistory.some((l) => l.responseType && l.responseContent)) continue;

    try {
      const result = await evaluateProspectQualification(prismaClient, {
        prospect,
        commHistory,
        campaign,
      });
      results.push({ prospectId: prospect.id, ...result });
    } catch (err) {
      results.push({ prospectId: prospect.id, error: err.message });
    }
  }

  return results;
}

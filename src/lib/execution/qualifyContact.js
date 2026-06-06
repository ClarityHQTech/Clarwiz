import { getOpenAIClient } from "@/lib/openaiClient";
import { getLatestProspectReply } from "@/lib/execution/humanizeOutboundMessage";
import { fireTransitionOnQualification } from "@/lib/mofu/transitionTrigger";

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

export async function markContactCampaignQualified(
  prismaClient,
  { contactCampaignId, campaignId, reason, sourceMeta = null, businessUserId = null, tenantId = null }
) {
  const cc = await prismaClient.contactCampaign.findFirst({
    where: { id: contactCampaignId, campaignId },
    include: { contact: true },
  });
  if (!cc) return { updated: false, contactCampaign: null };
  if (cc.status === "QUALIFIED") {
    return { updated: false, contactCampaign: cc, alreadyQualified: true };
  }

  const campaign = await prismaClient.campaign.findUnique({
    where: { id: campaignId },
    select: { tenantId: true },
  });

  const updated = await prismaClient.contactCampaign.update({
    where: { id: contactCampaignId },
    data: {
      status: "QUALIFIED",
      qualifiedAt: new Date(),
      qualifiedReason: reason,
    },
  });

  const buId = businessUserId ?? cc.contact?.businessUserId;
  if (sourceMeta && campaign?.tenantId && buId) {
    await prismaClient.businessUserSignal
      .create({
        data: {
          businessUserId: buId,
          tenantId: campaign.tenantId,
          campaignId,
          type: "qualification",
          source: reason,
          content: JSON.stringify(sourceMeta).slice(0, 2000),
        },
      })
      .catch(() => {});
  }

  // Additive TOFU->MOFU transition trigger (no-op unless CLARWIZ_AUTO_TRANSITION=1).
  await fireTransitionOnQualification(prismaClient, {
    contactCampaign: updated,
    tenantId: campaign?.tenantId ?? tenantId,
  }).catch(() => {});

  return { updated: true, contactCampaign: updated };
}

/** @deprecated */
export const markProspectQualified = markContactCampaignQualified;

function keywordQualificationHint(text) {
  if (!text?.trim()) return null;
  if (NEGATIVE_KEYWORDS.test(text)) return { qualified: false, disqualified: true };
  if (POSITIVE_KEYWORDS.test(text)) return { qualified: true };
  return null;
}

export async function evaluateContactCampaignQualification(
  prismaClient,
  { contactCampaign, prospect, commHistory, campaign }
) {
  const cc = contactCampaign ?? prospect;
  if (cc.status === "QUALIFIED" || cc.qualifiedAt) {
    return { qualified: false, skipped: true, reason: "already_qualified" };
  }

  const latestReply = getLatestProspectReply(commHistory);
  if (!latestReply?.responseContent?.trim()) {
    return { qualified: false, skipped: true, reason: "no_reply" };
  }

  const text = latestReply.responseContent.trim();
  const keywordHint = keywordQualificationHint(text);
  if (keywordHint?.disqualified) {
    await prismaClient.contactCampaign.update({
      where: { id: cc.id },
      data: { status: "DISQUALIFIED" },
    });
    return { qualified: false, reason: "negative_intent_keywords" };
  }
  if (keywordHint?.qualified === true) {
    await markContactCampaignQualified(prismaClient, {
      contactCampaignId: cc.id,
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
    await markContactCampaignQualified(prismaClient, {
      contactCampaignId: cc.id,
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

  await prismaClient.contactCampaign.update({
    where: { id: cc.id },
    data: { status: "REPLIED" },
  }).catch(() => {});

  return {
    qualified: false,
    reason: parsed.reason ?? "not_qualified",
    confidence: parsed.confidence,
  };
}

/** @deprecated */
export const evaluateProspectQualification = evaluateContactCampaignQualification;

export async function runPostTrackQualification(
  prismaClient,
  campaignId,
  { contactCampaignIds = [], prospectIds = [] } = {}
) {
  const ids = contactCampaignIds.length ? contactCampaignIds : prospectIds;
  const campaign = await prismaClient.campaign.findUnique({
    where: { id: campaignId },
    include: {
      contactCampaigns: ids.length
        ? { where: { id: { in: ids }, status: { not: "QUALIFIED" } } }
        : { where: { status: { not: "QUALIFIED" } } },
      commLogs: { orderBy: { sentAt: "asc" } },
    },
  });
  if (!campaign) return [];

  const results = [];
  const logsByCc = new Map();
  for (const log of campaign.commLogs) {
    const key = log.contactCampaignId;
    const list = logsByCc.get(key) ?? [];
    list.push(log);
    logsByCc.set(key, list);
  }

  for (const cc of campaign.contactCampaigns) {
    const commHistory = logsByCc.get(cc.id) ?? [];
    if (!commHistory.some((l) => l.responseType && l.responseContent)) continue;

    try {
      const result = await evaluateContactCampaignQualification(prismaClient, {
        contactCampaign: cc,
        commHistory,
        campaign,
      });
      results.push({ contactCampaignId: cc.id, prospectId: cc.id, ...result });
    } catch (err) {
      results.push({ contactCampaignId: cc.id, error: err.message });
    }
  }

  return results;
}

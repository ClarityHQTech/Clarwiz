import { getAnthropicClient, ANTHROPIC_MODEL_SIMPLE } from "@/lib/anthropicClient";
import { parseJsonLoose } from "@/lib/assist/intelligence/runner";
import { REPLY_INTENT_POINTS } from "@/lib/scoring/campaignContactScore";

/** Cheap keyword pre-filter so obvious replies skip the LLM call. */
const POSITIVE_KEYWORDS =
  /\b(book|schedule|demo|call|meeting|interested|let'?s talk|sounds good|send contract|deal|pricing|quote)\b/i;

const NEGATIVE_KEYWORDS =
  /\b(unsubscribe|not interested|no thanks|wrong person|stop emailing|remove me|do not contact|leave me alone)\b/i;

function intentResult(intent, reason) {
  return { intent, points: REPLY_INTENT_POINTS[intent], reason };
}

function keywordIntent(text) {
  if (NEGATIVE_KEYWORDS.test(text)) {
    return intentResult("negative", "negative_intent_keywords");
  }
  if (POSITIVE_KEYWORDS.test(text)) {
    return intentResult("positive", "positive_intent_keywords");
  }
  return null;
}

/**
 * Infer what a prospect reply actually means so scoring stays intelligent:
 * a negative reply must never add points, and only genuine buying intent
 * earns the full positive boost. Returns { intent, points, reason }.
 */
export async function classifyReplyIntent({ text, channel, campaign } = {}) {
  const trimmed = text?.trim();
  if (!trimmed) return intentResult("neutral", "empty_reply");

  const keyword = keywordIntent(trimmed);
  if (keyword) return keyword;

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    // No LLM available — fall back to a conservative neutral classification.
    return intentResult("neutral", "no_llm");
  }

  const model = ANTHROPIC_MODEL_SIMPLE;

  try {
    const completion = await client.messages.create({
      model,
      max_tokens: 256,
      temperature: 0.1,
      system: `You classify the intent of a B2B prospect reply for lead scoring.
positive = clear buying interest: wants a demo/call/meeting, asks for pricing, moves the deal forward, explicitly interested.
negative = unsubscribe, "not interested", wrong person, hostile, asks to stop contact.
neutral = out-of-office, polite brush-off, a question without commitment, generic "thanks", or anything ambiguous.
Be strict: do not mark something positive unless there is genuine intent to engage.

Respond with valid JSON only shaped as {"intent":"positive"|"neutral"|"negative","reason":string}.`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            campaignGoals: campaign?.goals ?? null,
            replyChannel: channel ?? null,
            replyText: trimmed.slice(0, 1500),
          }),
        },
      ],
    });

    const raw =
      completion.content?.find((b) => b.type === "text")?.text ?? "{}";
    const parsed = parseJsonLoose(raw) ?? {};
    const intent =
      parsed.intent === "positive" ||
      parsed.intent === "negative" ||
      parsed.intent === "neutral"
        ? parsed.intent
        : "neutral";
    return intentResult(intent, parsed.reason || `llm_${intent}`);
  } catch {
    return intentResult("neutral", "llm_error");
  }
}

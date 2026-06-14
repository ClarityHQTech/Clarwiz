import { getAnthropicClient, ANTHROPIC_MODEL_SIMPLE } from "@/lib/anthropicClient";
import { buildRichPersonalizationContext } from "@/lib/assist/richCollateral/buildPersonalizationContext";
import { providerFieldsFromCompletion } from "@/lib/assist/providerMetadata";

const SYSTEM = `You are a B2B sales collateral copywriter.
You receive a complete HTML document (with embedded CSS) and TENANT + PROSPECT context.

Your job is HYPER-PERSONALIZATION: rewrite every visible text string so the collateral speaks directly to this tenant selling to this specific prospect company and deal.

REWRITE (when present in the HTML):
- Headlines, subheads, eyebrows, taglines, intro paragraphs
- Capability/feature card titles AND descriptions (text beside emoji/symbol icons)
- Flywheel or diagram labels and supporting copy
- Checklist bullets, workflow steps, pricing tier descriptions, footnotes, CTAs
- Tool/module row labels and short descriptions
- Any generic product copy — make it specific to the tenant's positioning and the prospect's industry, pains, and deal stage

PRESERVE EXACTLY:
- All HTML structure, tags, nesting, class names, ids, inline styles
- All embedded CSS in <style> blocks
- Layout, sections, page count, emoji/symbol characters inside icon circles (◎ ⚡ ✉ etc.)
- Image URLs and hrefs unless clearly placeholder

RULES:
- Use ONLY facts from AVAILABLE FACTS and context JSON. Never invent revenue, logos, compliance certs, or customer quotes.
- Name the tenant (seller) and prospect company naturally throughout.
- Reflect deal stage and champion persona when known.
- If a fact is missing, write credible but generic copy — do not fabricate specifics.
- Do not add <script>. Do not remove pages or sections.

Return the FULL updated HTML document only — no markdown fences, no commentary.`;

export const HYPER_PERSONALIZE_INSTRUCTION =
  "Hyper-personalize ALL visible copy for this tenant and prospect deal — including text beside icons, capability descriptions, bullets, steps, and footnotes. Keep design and structure identical. Facts only from context.";

/**
 * @param {object} args
 * @param {string} args.html
 * @param {object} args.context  assembleProspectContext output or demo subset
 * @param {string} [args.instruction]
 */
export async function personalizeRichHtml({
  html,
  context = {},
  instruction = HYPER_PERSONALIZE_INSTRUCTION,
  model = process.env.NBA_DRAFT_MODEL?.trim() || ANTHROPIC_MODEL_SIMPLE,
} = {}) {
  const llm = getAnthropicClient();
  const payload = buildRichPersonalizationContext(context);

  const user = [
    instruction ? `TASK: ${instruction}` : "",
    "AVAILABLE FACTS:",
    payload.availableFacts,
    "",
    "FULL CONTEXT (JSON):",
    JSON.stringify(payload, null, 2),
    "",
    "HTML TO HYPER-PERSONALIZE (return full document):",
    html,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await llm.messages.create({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  const text = (res.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const cleaned = text
    .replace(/^```html?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned.includes("<html") && !cleaned.includes("<!DOCTYPE")) {
    throw new Error("ai_returned_invalid_html");
  }
  return {
    html: cleaned,
    ...providerFieldsFromCompletion(res, model),
  };
}

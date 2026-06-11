/**
 * Thin, injectable wrapper around an Anthropic-shaped messages client for JSON prompts.
 * Kept LLM-agnostic so compute.js can be unit-tested with a fake `llm`.
 */

/**
 * Robustly parse a model's JSON reply: strips ```json / ``` fences, then falls
 * back to extracting the first {...} object found in prose. Returns null on
 * failure instead of throwing, so one bad reply never crashes a recompute step.
 */
export function parseJsonLoose(raw) {
  if (raw == null) return null;
  let text = String(raw).trim();

  // Strip a leading ```json / ``` fence and a trailing ``` fence.
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    // Fall through to embedded-object extraction.
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** Normalize Anthropic or OpenAI-shaped usage into a common token shape. */
export function normalizeTokenUsage(usage) {
  if (!usage) return null;
  if (usage.prompt_tokens != null || usage.completion_tokens != null) {
    return {
      prompt_tokens: usage.prompt_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      total_tokens:
        usage.total_tokens ??
        (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
    };
  }
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  return {
    prompt_tokens: input,
    completion_tokens: output,
    total_tokens: input + output,
  };
}

function extractTextContent(res) {
  const blocks = res?.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Call messages.create with a system+user message pair; expect JSON in the reply.
 * Returns { data: parsedObject|null, tokensUsed }.
 */
export async function runJsonPrompt({ llm, model, system, user, temperature = 0.3 }) {
  const res = await llm.messages.create({
    model,
    max_tokens: 4096,
    system: `${system}\n\nRespond with valid JSON only — no markdown fences or prose.`,
    messages: [{ role: "user", content: user }],
    temperature,
  });

  const content = extractTextContent(res);
  const data = parseJsonLoose(content);
  const tokensUsed = normalizeTokenUsage(res?.usage);
  return { data, tokensUsed };
}

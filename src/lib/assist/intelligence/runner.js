/**
 * Thin, injectable wrapper around an OpenAI-shaped chat client for JSON prompts.
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

/**
 * Call chat.completions with a system+user message pair in json mode.
 * Returns { data: parsedObject|null, tokensUsed }.
 */
export async function runJsonPrompt({ llm, model, system, user, temperature = 0.3 }) {
  const res = await llm.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature,
  });

  const content = res?.choices?.[0]?.message?.content ?? "";
  const data = parseJsonLoose(content);
  const tokensUsed = res?.usage ?? null;
  return { data, tokensUsed };
}

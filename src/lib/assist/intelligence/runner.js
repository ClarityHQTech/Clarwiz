/**
 * Thin, injectable wrapper around an Anthropic-shaped messages client for JSON prompts.
 * Kept LLM-agnostic so compute.js can be unit-tested with a fake `llm`.
 */

/** Model output budget — only overridden when callers pass max_tokens explicitly. */
export function defaultMaxTokensForModel(model = "") {
  const env = Number(process.env.INTELLIGENCE_MAX_TOKENS);
  if (Number.isFinite(env) && env > 0) return Math.min(env, 64000);
  const m = String(model).toLowerCase();
  if (m.includes("opus")) return 32000;
  if (m.includes("sonnet")) return 16384;
  return 8192;
}

const AURA_SALVAGE_KEYS = [
  "signals",
  "nba_action",
  "core_entities",
  "account_score",
  "account_level_briefing",
  "brief_summary",
  "your_coach_speaks",
];

function stripMarkdownFence(text) {
  const closed = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (closed) return closed[1].trim();
  const open = text.match(/^```(?:json)?\s*([\s\S]*)$/i);
  if (open) return open[1].trim();
  return text;
}

/** Extract a JSON array value for `key` using bracket matching (truncation-safe). */
export function extractJsonArray(text, key) {
  const marker = `"${key}"`;
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const arrStart = text.indexOf("[", idx);
  if (arrStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = arrStart; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(arrStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Best-effort recovery when the model truncates mid-object. */
export function salvageAuraJson(text) {
  const out = {};
  for (const key of AURA_SALVAGE_KEYS) {
    if (key === "signals" || key === "nba_action") {
      const arr = extractJsonArray(text, key);
      if (Array.isArray(arr) && arr.length) out[key] = arr;
      continue;
    }
    const re = new RegExp(`"${key}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|\\{[\\s\\S]*?\\}|[^,\\n}]+)`);
    const m = text.match(re);
    if (!m) continue;
    try {
      out[key] = JSON.parse(m[1]);
    } catch {
      out[key] = String(m[1]).replace(/^"|"$/g, "");
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Robustly parse a model's JSON reply: strips ```json / ``` fences, then falls
 * back to extracting the first {...} object found in prose. Returns null on
 * failure instead of throwing, so one bad reply never crashes a recompute step.
 */
export function parseJsonLoose(raw) {
  if (raw == null) return null;
  let text = stripMarkdownFence(String(raw).trim());

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
      return salvageAuraJson(text.slice(start, end + 1)) ?? salvageAuraJson(text.slice(start));
    }
  }
  if (start !== -1) {
    return salvageAuraJson(text.slice(start));
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
export async function runJsonPrompt({
  llm,
  model,
  system,
  user,
  temperature = 0.3,
  max_tokens,
}) {
  const res = await llm.messages.create({
    model,
    max_tokens: max_tokens ?? defaultMaxTokensForModel(model),
    system: `${system}\n\nRespond with valid JSON only — no markdown fences or prose.`,
    messages: [{ role: "user", content: user }],
    temperature,
  });

  const content = extractTextContent(res);
  const data = parseJsonLoose(content);
  const tokensUsed = normalizeTokenUsage(res?.usage);
  const truncated = res?.stop_reason === "max_tokens";
  return { data, tokensUsed, truncated, raw: content };
}

/** Pull a signals array from parsed JSON or salvage truncated output. */
export function extractSignalsPayload(data, raw) {
  const fromData = Array.isArray(data?.signals) ? data.signals : [];
  if (fromData.length) return fromData;
  if (!raw) return [];
  const salvaged = salvageAuraJson(raw.includes("{") ? raw.slice(raw.indexOf("{")) : raw);
  return Array.isArray(salvaged?.signals) ? salvaged.signals : [];
}

/** Pull NBA actions from parsed JSON or salvage truncated output. */
export function extractNbaPayload(data, raw) {
  const fromData = Array.isArray(data?.nba_action) ? data.nba_action : [];
  if (fromData.length) return fromData;
  if (!raw) return [];
  const salvaged = salvageAuraJson(raw.includes("{") ? raw.slice(raw.indexOf("{")) : raw);
  return Array.isArray(salvaged?.nba_action) ? salvaged.nba_action : [];
}

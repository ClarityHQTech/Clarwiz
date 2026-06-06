// Anthropic usage + pricing, parallel to openaiUsage.js. Used by the dual-model jury.

export const ANTHROPIC_MODEL_COMPLEX =
  process.env.ANTHROPIC_MODEL_COMPLEX || "claude-sonnet-4-6";
export const ANTHROPIC_MODEL_SIMPLE =
  process.env.ANTHROPIC_MODEL_SIMPLE || "claude-haiku-4-5";

/** USD per 1M tokens — approximate; update when Anthropic pricing changes. */
const ANTHROPIC_PRICING_PER_1M = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-4-8": { input: 15, output: 75 },
};
const DEFAULT_PRICING = { input: 3, output: 15 };

export function roundUsd(value) {
  return Math.round(value * 1e6) / 1e6;
}

export function getAnthropicPricing(model) {
  if (!model) return DEFAULT_PRICING;
  if (ANTHROPIC_PRICING_PER_1M[model]) return ANTHROPIC_PRICING_PER_1M[model];
  if (model.includes("haiku")) return ANTHROPIC_PRICING_PER_1M["claude-haiku-4-5"];
  if (model.includes("opus")) return ANTHROPIC_PRICING_PER_1M["claude-opus-4-8"];
  return DEFAULT_PRICING;
}

/** Normalize Anthropic usage to the same shape as OpenAI usage. */
export function extractAnthropicUsage(msg) {
  const u = msg?.usage ?? {};
  const prompt = u.input_tokens ?? 0;
  const completion = u.output_tokens ?? 0;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

export function calculateAnthropicCost(model, usage) {
  const p = getAnthropicPricing(model);
  const input = (usage.prompt_tokens / 1_000_000) * p.input;
  const output = (usage.completion_tokens / 1_000_000) * p.output;
  return {
    input_cost_usd: roundUsd(input),
    output_cost_usd: roundUsd(output),
    total_cost_usd: roundUsd(input + output),
  };
}

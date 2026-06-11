/** USD per 1M tokens — update when Anthropic pricing changes */
const MODEL_PRICING_PER_1M = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-opus-4-8": { input: 15.0, output: 75.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

function roundUsd(value) {
  return Math.round(value * 1e6) / 1e6;
}

export function getModelPricing(model) {
  if (!model) return DEFAULT_PRICING;
  if (MODEL_PRICING_PER_1M[model]) return MODEL_PRICING_PER_1M[model];
  if (model.includes("haiku")) return MODEL_PRICING_PER_1M["claude-haiku-4-5"];
  if (model.includes("opus")) return MODEL_PRICING_PER_1M["claude-opus-4-8"];
  if (model.includes("sonnet") || model.startsWith("claude-")) {
    return MODEL_PRICING_PER_1M["claude-sonnet-4-5"];
  }
  return DEFAULT_PRICING;
}

export function extractProviderUsage(completion) {
  const usage = completion?.usage ?? {};
  if (usage.input_tokens != null || usage.output_tokens != null) {
    const input = usage.input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    return {
      prompt_tokens: input,
      completion_tokens: output,
      total_tokens: input + output,
    };
  }
  return {
    prompt_tokens: usage.prompt_tokens ?? 0,
    completion_tokens: usage.completion_tokens ?? 0,
    total_tokens: usage.total_tokens ?? 0,
  };
}

export function calculateProviderCost(model, providerUsage) {
  const pricing = getModelPricing(model);
  const inputCost =
    (providerUsage.prompt_tokens / 1_000_000) * pricing.input;
  const outputCost =
    (providerUsage.completion_tokens / 1_000_000) * pricing.output;

  return {
    input_cost_usd: roundUsd(inputCost),
    output_cost_usd: roundUsd(outputCost),
    total_cost_usd: roundUsd(inputCost + outputCost),
  };
}

export function buildProviderMetadata(completion, model) {
  const providerUsage = extractProviderUsage(completion);
  const providerCost = calculateProviderCost(model, providerUsage);

  return {
    model,
    providerUsage,
    providerCost,
  };
}

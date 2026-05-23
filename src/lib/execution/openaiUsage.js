/** USD per 1M tokens — update when OpenAI pricing changes */
const MODEL_PRICING_PER_1M = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-08-06": { input: 2.5, output: 10.0 },
  "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.6 },
};

const DEFAULT_PRICING = { input: 2.5, output: 10.0 };

function roundUsd(value) {
  return Math.round(value * 1e6) / 1e6;
}

export function getModelPricing(model) {
  if (!model) return DEFAULT_PRICING;
  if (MODEL_PRICING_PER_1M[model]) return MODEL_PRICING_PER_1M[model];
  if (model.includes("mini")) return MODEL_PRICING_PER_1M["gpt-4o-mini"];
  if (model.startsWith("gpt-4o")) return MODEL_PRICING_PER_1M["gpt-4o"];
  return DEFAULT_PRICING;
}

export function extractProviderUsage(completion) {
  const usage = completion?.usage ?? {};
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

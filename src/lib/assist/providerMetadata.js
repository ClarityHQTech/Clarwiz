import {
  buildProviderMetadata,
  calculateProviderCost,
} from "@/lib/execution/openaiUsage";

function roundUsd(value) {
  return Math.round(value * 1e6) / 1e6;
}

/** Normalize runner tokensUsed or raw Anthropic usage into CommunicationLog-shaped usage. */
export function normalizeProviderUsage(usage) {
  if (!usage) return null;
  if (usage.prompt_tokens != null || usage.completion_tokens != null) {
    const prompt = usage.prompt_tokens ?? 0;
    const completion = usage.completion_tokens ?? 0;
    return {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: usage.total_tokens ?? prompt + completion,
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

/** Build AssistActionLog provider columns from a model + token usage object. */
export function providerFieldsFromTokens(model, tokensUsed) {
  const providerUsage = normalizeProviderUsage(tokensUsed);
  if (!model || !providerUsage) return {};
  return {
    modelUsed: model,
    providerUsage,
    providerCost: calculateProviderCost(model, providerUsage),
  };
}

/** Build AssistActionLog provider columns from a raw LLM completion response. */
export function providerFieldsFromCompletion(completion, model) {
  if (!completion || !model) return {};
  const meta = buildProviderMetadata(completion, model);
  return {
    modelUsed: meta.model,
    providerUsage: meta.providerUsage,
    providerCost: meta.providerCost,
  };
}

/** Sum token usage and cost across one or more provider field objects. */
export function mergeAssistProviderFields(items) {
  const valid = (items ?? []).filter((i) => i?.providerUsage);
  if (!valid.length) return {};

  const providerUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  const providerCost = {
    input_cost_usd: 0,
    output_cost_usd: 0,
    total_cost_usd: 0,
  };
  const models = new Set();

  for (const item of valid) {
    const u = item.providerUsage;
    providerUsage.prompt_tokens += u.prompt_tokens ?? 0;
    providerUsage.completion_tokens += u.completion_tokens ?? 0;
    providerUsage.total_tokens += u.total_tokens ?? 0;
    providerCost.input_cost_usd += item.providerCost?.input_cost_usd ?? 0;
    providerCost.output_cost_usd += item.providerCost?.output_cost_usd ?? 0;
    providerCost.total_cost_usd += item.providerCost?.total_cost_usd ?? 0;
    if (item.modelUsed) models.add(item.modelUsed);
  }

  providerCost.input_cost_usd = roundUsd(providerCost.input_cost_usd);
  providerCost.output_cost_usd = roundUsd(providerCost.output_cost_usd);
  providerCost.total_cost_usd = roundUsd(providerCost.total_cost_usd);

  let modelUsed = null;
  if (models.size === 1) modelUsed = [...models][0];
  else if (models.size > 1) modelUsed = "mixed";

  return { modelUsed, providerUsage, providerCost };
}

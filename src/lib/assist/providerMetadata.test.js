import { describe, it, expect } from "vitest";
import {
  mergeAssistProviderFields,
  providerFieldsFromTokens,
} from "./providerMetadata.js";

describe("providerFieldsFromTokens", () => {
  it("builds modelUsed, providerUsage, and providerCost", () => {
    const fields = providerFieldsFromTokens("claude-sonnet-4-5", {
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
    });
    expect(fields.modelUsed).toBe("claude-sonnet-4-5");
    expect(fields.providerUsage).toEqual({
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
    });
    expect(fields.providerCost.total_cost_usd).toBeGreaterThan(0);
  });
});

describe("mergeAssistProviderFields", () => {
  it("sums usage and cost across multiple calls", () => {
    const a = providerFieldsFromTokens("claude-sonnet-4-5", {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    });
    const b = providerFieldsFromTokens("claude-haiku-4-5", {
      prompt_tokens: 200,
      completion_tokens: 100,
      total_tokens: 300,
    });
    const merged = mergeAssistProviderFields([a, b]);
    expect(merged.modelUsed).toBe("mixed");
    expect(merged.providerUsage).toEqual({
      prompt_tokens: 300,
      completion_tokens: 150,
      total_tokens: 450,
    });
    expect(merged.providerCost.total_cost_usd).toBeCloseTo(
      a.providerCost.total_cost_usd + b.providerCost.total_cost_usd,
      6
    );
  });
});

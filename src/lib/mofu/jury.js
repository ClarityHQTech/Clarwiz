import { getOpenAIClient } from "@/lib/openaiClient";
import { getAnthropicClient } from "@/lib/anthropicClient";
import { extractProviderUsage, calculateProviderCost } from "@/lib/execution/openaiUsage";
import {
  extractAnthropicUsage,
  calculateAnthropicCost,
  ANTHROPIC_MODEL_COMPLEX,
  roundUsd,
} from "@/lib/execution/providerUsage";

const OPENAI_MODEL = process.env.OPENAI_MODEL_COMPLEX || "gpt-4o";

/** Call OpenAI for a JSON-schema-constrained structured result. */
export async function callOpenAIStructured({ system, user, schema, model = OPENAI_MODEL }) {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model,
    response_format: {
      type: "json_schema",
      json_schema: { name: "jury_output", schema, strict: false },
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content: typeof user === "string" ? user : JSON.stringify(user) },
    ],
  });
  const data = JSON.parse(completion.choices?.[0]?.message?.content ?? "{}");
  const usage = extractProviderUsage(completion);
  return { provider: "openai", model, data, usage, cost: calculateProviderCost(model, usage) };
}

/** Call Anthropic via a forced tool to get a JSON-schema-constrained structured result. */
export async function callAnthropicStructured({ system, user, schema, model = ANTHROPIC_MODEL_COMPLEX }) {
  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    tools: [{ name: "emit", description: "Emit the structured result.", input_schema: schema }],
    tool_choice: { type: "tool", name: "emit" },
    messages: [
      { role: "user", content: typeof user === "string" ? user : JSON.stringify(user) },
    ],
  });
  const toolUse = (msg.content || []).find((b) => b.type === "tool_use");
  const data = toolUse?.input ?? {};
  const usage = extractAnthropicUsage(msg);
  return { provider: "anthropic", model, data, usage, cost: calculateAnthropicCost(model, usage) };
}

/**
 * D2/D4 dual-model jury. Runs OpenAI + Anthropic on the same structured task and
 * reconciles:
 *  - purpose "ranking": higher-confidence model wins.
 *  - purpose "send_eligibility"/"acceptance": agreement-or-escalate on `approved`.
 * One provider down -> degrade to single-provider with a warning. Both down -> throws.
 * Records both opinions + per-provider usage/cost in juryResult.
 */
export async function runJury({ system, user, schema, purpose = "ranking", deps = {} }) {
  const runOpenAI = deps.runOpenAI ?? callOpenAIStructured;
  const runAnthropic = deps.runAnthropic ?? callAnthropicStructured;

  const settled = await Promise.allSettled([
    runOpenAI({ system, user, schema }),
    runAnthropic({ system, user, schema }),
  ]);
  const ok = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  const failed = settled
    .filter((s) => s.status === "rejected")
    .map((s) => s.reason?.message || "provider_error");

  if (ok.length === 0) {
    const err = new Error("jury_all_providers_failed");
    err.code = "jury_failed";
    err.failed = failed;
    throw err;
  }

  const providerUsage = {};
  const providerCost = {};
  let totalCost = 0;
  for (const r of ok) {
    providerUsage[r.provider] = r.usage;
    providerCost[r.provider] = r.cost;
    totalCost += r.cost.total_cost_usd;
  }
  const byProvider = Object.fromEntries(ok.map((r) => [r.provider, r.data]));

  let result;
  let reconciliation;

  if (ok.length === 1) {
    result = ok[0].data;
    reconciliation = {
      mode: "single_provider",
      provider: ok[0].provider,
      warning: "jury_degraded_single_provider",
      failed,
    };
  } else if (purpose === "send_eligibility" || purpose === "acceptance") {
    const o = byProvider.openai;
    const a = byProvider.anthropic;
    const agree = !!o?.approved === !!a?.approved;
    if (agree) {
      result = { ...o, approved: !!o?.approved, escalate: false };
      reconciliation = { mode: "agreement", agreed: true, decision: !!o?.approved };
    } else {
      result = { approved: false, escalate: true };
      reconciliation = {
        mode: "disagreement_escalate",
        agreed: false,
        openai: !!o?.approved,
        anthropic: !!a?.approved,
      };
    }
  } else {
    // ranking: higher-confidence model wins
    const o = byProvider.openai;
    const a = byProvider.anthropic;
    const co = Number(o?.confidence ?? 0.5);
    const ca = Number(a?.confidence ?? 0.5);
    const winner = ca > co ? "anthropic" : "openai";
    result = winner === "anthropic" ? a : o;
    reconciliation = { mode: "higher_confidence", winner, openaiConfidence: co, anthropicConfidence: ca };
  }

  return {
    result,
    juryResult: {
      providers: ok.map((r) => ({ provider: r.provider, model: r.model, data: r.data })),
      reconciliation,
      failed,
    },
    modelUsed: ok.map((r) => `${r.provider}:${r.model}`).join("+"),
    providerUsage,
    providerCost,
    providerCostTotal: roundUsd(totalCost),
    degraded: ok.length < 2,
  };
}

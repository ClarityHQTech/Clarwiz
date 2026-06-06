import { describe, it, expect } from "vitest";
import { runJury } from "@/lib/mofu/jury";

const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
const cost = { input_cost_usd: 0.0001, output_cost_usd: 0.0001, total_cost_usd: 0.0002 };

function fakeProvider(provider, data) {
  return async () => ({ provider, model: `${provider}-model`, data, usage, cost });
}

describe("runJury", () => {
  it("ranking: higher-confidence model wins, records both opinions", async () => {
    const out = await runJury({
      system: "s",
      user: "u",
      schema: {},
      purpose: "ranking",
      deps: {
        runOpenAI: fakeProvider("openai", { pick: "A", confidence: 0.6 }),
        runAnthropic: fakeProvider("anthropic", { pick: "B", confidence: 0.9 }),
      },
    });
    expect(out.result.pick).toBe("B");
    expect(out.juryResult.reconciliation).toMatchObject({ mode: "higher_confidence", winner: "anthropic" });
    expect(out.juryResult.providers).toHaveLength(2);
    expect(out.providerCostTotal).toBeCloseTo(0.0004, 6);
    expect(out.degraded).toBe(false);
  });

  it("send_eligibility: agreement passes the decision through", async () => {
    const out = await runJury({
      system: "s", user: "u", schema: {}, purpose: "send_eligibility",
      deps: {
        runOpenAI: fakeProvider("openai", { approved: true, reason: "ok" }),
        runAnthropic: fakeProvider("anthropic", { approved: true }),
      },
    });
    expect(out.result.approved).toBe(true);
    expect(out.result.escalate).toBe(false);
    expect(out.juryResult.reconciliation.mode).toBe("agreement");
  });

  it("send_eligibility: disagreement escalates (no send)", async () => {
    const out = await runJury({
      system: "s", user: "u", schema: {}, purpose: "send_eligibility",
      deps: {
        runOpenAI: fakeProvider("openai", { approved: true }),
        runAnthropic: fakeProvider("anthropic", { approved: false }),
      },
    });
    expect(out.result).toEqual({ approved: false, escalate: true });
    expect(out.juryResult.reconciliation.mode).toBe("disagreement_escalate");
  });

  it("degrades to single provider when one fails (with warning)", async () => {
    const out = await runJury({
      system: "s", user: "u", schema: {}, purpose: "ranking",
      deps: {
        runOpenAI: fakeProvider("openai", { pick: "A", confidence: 0.7 }),
        runAnthropic: async () => { throw new Error("anthropic_down"); },
      },
    });
    expect(out.result.pick).toBe("A");
    expect(out.degraded).toBe(true);
    expect(out.juryResult.reconciliation.warning).toBe("jury_degraded_single_provider");
  });

  it("throws when both providers fail", async () => {
    await expect(
      runJury({
        system: "s", user: "u", schema: {}, purpose: "ranking",
        deps: {
          runOpenAI: async () => { throw new Error("x"); },
          runAnthropic: async () => { throw new Error("y"); },
        },
      })
    ).rejects.toMatchObject({ code: "jury_failed" });
  });
});

import { prisma as defaultPrisma } from "@/lib/prisma";
import { runJury } from "@/lib/mofu/jury";
import { NBA_ACTION_TYPES, isClosedActionType } from "@/lib/mofu/nbaActions";

// US-4.1 — Deal-centric NBA brain. FORK of the prospect-centric TOFU
// decideNextAction (shares only modelRouter/jury helpers). Candidates come from
// the bundle's actionable_recommendations, constrained to the closed action set,
// ranked by the dual-model jury, persisted as SUGGESTED NbaRecommendation rows.

const RANK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ranking: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          score: { type: "number" },
          reason: { type: "string" },
        },
        required: ["index", "score"],
      },
    },
    confidence: { type: "number" },
  },
  required: ["ranking"],
};

const RANK_SYSTEM = `You are an Account Executive's next-best-action ranker for a single deal. Given candidate actions (each from the closed set) and the deal's scored signals, return a ranking: an array of {index, score in [0,1], reason} ordered best-first, plus an overall confidence in [0,1]. Ground each high rank in a specific signal. Never invent actions; only rank the given candidates by index.`;

/** Map bundle.actionable_recommendations to closed-set candidates. */
export function deriveCandidates(bundle) {
  const recs = Array.isArray(bundle?.actionable_recommendations)
    ? bundle.actionable_recommendations
    : [];
  return recs
    .map((r) => ({
      action_type: r.action_type,
      title: r.title || r.action_title || "Next best action",
      signal_reference_id: r.signal_reference_id ?? null,
      rationale: r.rationale ?? r.reason ?? null,
    }))
    .filter((c) => isClosedActionType(c.action_type));
}

export async function computeNba(
  { tenantId, dealId, scope = "DEAL", bundle, signals = [] },
  deps = {}
) {
  const prisma = deps.prisma ?? defaultPrisma;
  const jury = deps.jury ?? runJury;

  const candidates = deriveCandidates(bundle);
  if (candidates.length === 0) return { recommendations: [], candidates: [] };

  let ranked;
  try {
    ranked = await jury({
      system: RANK_SYSTEM,
      user: {
        candidates,
        signals: signals.map((s) => ({
          id: s.signalReferenceId,
          kind: s.kind,
          score: s.score,
          summary: s.summary,
        })),
      },
      schema: RANK_SCHEMA,
      purpose: "ranking",
      deps: deps.juryDeps,
    });
  } catch (err) {
    // Both providers down -> deterministic fallback so the deal is never blank.
    ranked = {
      result: { ranking: candidates.map((_, i) => ({ index: i, score: 0 })) },
      juryResult: { reconciliation: { mode: "jury_unavailable", warning: err.message } },
      modelUsed: null,
      providerUsage: null,
      providerCost: null,
    };
  }

  const order = Array.isArray(ranked.result?.ranking) && ranked.result.ranking.length
    ? ranked.result.ranking
    : candidates.map((_, i) => ({ index: i, score: 0 }));

  const recommendations = [];
  for (const item of order) {
    const c = candidates[item.index];
    if (!c) continue;
    const row = await prisma.nbaRecommendation.create({
      data: {
        tenantId,
        dealId,
        scope,
        actionType: c.action_type,
        title: c.title,
        score: Number(item.score ?? 0),
        signalReferenceId: c.signal_reference_id,
        status: "SUGGESTED",
        payload: { rationale: c.rationale, rankReason: item.reason ?? null },
        juryResult: ranked.juryResult,
        modelUsed: ranked.modelUsed,
        providerUsage: ranked.providerUsage,
        providerCost: ranked.providerCost,
      },
    });
    recommendations.push(row);
  }
  return { recommendations, candidates };
}

export { NBA_ACTION_TYPES };

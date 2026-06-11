/**
 * F2 Intelligence Core — computes & PERSISTS AURA insights IN-CLARWIZ.
 *
 * Pipeline per deal: assemble context → run AURA prompts (signal / nba /
 * company) through an injectable LLM → normalize the model's JSON → write
 * Signal / NbaRecommendation / DealInsight rows. recomputeDeal orchestrates all
 * three with independent try/catch so one failing LLM call can't sink the rest.
 *
 * The COMPANY prompt is the account briefing; it ALSO drives the deal-level
 * insight (account_score, gtm paths, early warnings, coaching) — there is no
 * separate "deal" prompt in the AURA spec.
 */
import { getMofuIntegration } from "@/lib/assist/mofuIntegration";
import { getAnthropicClient, ANTHROPIC_MODEL_SIMPLE } from "@/lib/anthropicClient";
import { logAssistAction } from "@/lib/assist/logAction";
import { assembleDealContext, assembleCompanyContext } from "@/lib/assist/context/assembleContext.js";
import { fillTemplate, SIGNAL_SYSTEM, SIGNAL_USER, NBA_SYSTEM, NBA_USER, COMPANY_SYSTEM, COMPANY_USER } from "@/lib/assist/prompts/index.js";
import { ONTOLOGY, PROMPT_VERSION } from "@/lib/assist/prompts/ontology.js";
import { runJsonPrompt } from "./runner.js";

// ---------------------------------------------------------------------------
// pure normalization helpers (unit-tested)
// ---------------------------------------------------------------------------

/** Coerce "77", "77/100", "77%", 77, "+12" → integer; null when unparseable. */
export function toInt(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Math.round(parseFloat(m[0]));
  return Number.isFinite(n) ? n : null;
}

/** Category = the part before "::" in a Category::Subtype token. */
export function categoryOf(type) {
  if (!type || typeof type !== "string") return null;
  const i = type.indexOf("::");
  return i === -1 ? type : type.slice(0, i);
}

/** Map an AURA action/verb to one of the NbaRecommendation high-level actionTypes. */
export function deriveActionType(nba) {
  const verb = String(nba?.action_verb ?? "").toLowerCase();
  const action = String(nba?.core_action ?? nba?.action ?? nba?.action_title ?? "").toLowerCase();
  const hay = `${verb} ${action}`;
  if (/(battlecard|collateral|one[\s_-]?pager|deck|\broi\b|asset|case[\s_-]?study|guide)/.test(hay)) return "send_collateral";
  if (/(meeting|qbr|\bcall\b|\bdemo\b|schedule|workshop)/.test(hay)) return "schedule_meeting";
  if (/(task|assign|escalat|route)/.test(hay)) return "create_task";
  if (/(clarify|technical|confusion|integrat)/.test(hay)) return "clarify_technical";
  return "draft_email";
}

/** TOFU fallback signals when the model output is empty but campaign history exists. */
export function bootstrapSignalsFromTofuCampaign(campaignContexts = []) {
  const signals = [];
  for (const ctx of campaignContexts) {
    if (!ctx || ctx.status !== "QUALIFIED") continue;
    const name = ctx.contact?.businessUser?.name || "Contact";
    const campaign = ctx.campaign?.name || "outreach campaign";
    const reason = ctx.qualifiedReason || "qualified";
    const logs = ctx.commLogs ?? [];
    const lastInbound = [...logs].reverse().find((l) => l.responseContent?.trim());
    const lastOutbound = [...logs].reverse().find((l) => l.message?.trim());

    signals.push({
      signal_type: "Intent::Qualified_Lead",
      signal_score: String(Math.min(100, Math.max(50, ctx.score ?? 75))),
      confidence: "85",
      context: `${name} qualified in Clarwiz campaign "${campaign}" (${reason}).`,
      supporting_quote_customer: lastInbound?.responseContent?.trim() || null,
      supporting_quote_ae: lastOutbound?.message?.trim()?.slice(0, 500) || null,
      raised_by: name,
    });

    if (lastInbound?.responseContent?.trim()) {
      signals.push({
        signal_type: "Behavior::Positive_Reply",
        signal_score: "80",
        confidence: "80",
        context: "Prospect responded during TOFU outreach.",
        supporting_quote_customer: lastInbound.responseContent.trim(),
        raised_by: name,
      });
    }
  }
  return signals;
}

/** User-facing summary for a deal recompute result. */
export function formatRecomputeSummary(summary) {
  if (!summary) return "Intelligence refreshed";
  const parts = [];
  if (summary.signals > 0) parts.push(`${summary.signals} signal${summary.signals === 1 ? "" : "s"}`);
  if (summary.nbas > 0) parts.push(`${summary.nbas} NBA${summary.nbas === 1 ? "" : "s"}`);
  if (summary.insight) parts.push("briefing");
  if (!parts.length) {
    return summary.errors?.length
      ? `Intelligence run failed: ${summary.errors.join("; ")}`
      : "No signals or actions were generated — check outreach history and try again.";
  }
  return `Intelligence refreshed — ${parts.join(", ")}`;
}

/** Shape a Signal create-payload from one AURA signal object (no DB write). */
export function buildSignalData(tenantId, dealId, accountId, sig) {
  const type = sig?.signal_type ?? "Unknown::Signal";
  const headline = String(sig?.context || sig?.signal_type || "Signal").slice(0, 500);
  return {
    tenantId,
    dealId: dealId ?? null,
    accountId: accountId ?? null,
    type: String(type).slice(0, 200),
    category: categoryOf(type),
    score: toInt(sig?.signal_score),
    confidence: toInt(sig?.confidence),
    headline,
    evidence: sig?.supporting_quote_customer ?? null,
    suggestedAngle: sig?.supporting_quote_ae ?? null,
    payload: sig ?? {},
  };
}

/** Shape an NbaRecommendation create-payload from one AURA nba_action object. */
export function buildNbaData(tenantId, dealId, nba) {
  const score = toInt(nba?.action_score) ?? toInt(nba?.impact_score) ?? toInt(nba?.priority) ?? 0;
  return {
    tenantId,
    dealId: dealId ?? null,
    title: nba?.action_title || nba?.core_action || "Next best action",
    actionType: deriveActionType(nba),
    actionVerb: nba?.action_verb ?? null,
    score: score ?? 0,
    rationale: nba?.justification ?? null,
    status: "SUGGESTED",
    payload: nba ?? {},
  };
}

/** Shape a DealInsight create-payload from the parsed COMPANY (account) briefing. */
export function buildDealInsightData(tenantId, dealId, parsed, { model, tokensUsed } = {}) {
  const briefing =
    parsed?.account_level_briefing && typeof parsed.account_level_briefing === "string"
      ? parsed.account_level_briefing
      : null;
  return {
    tenantId,
    dealId,
    score: toInt(parsed?.account_score),
    briefing: parsed?.your_coach_speaks ?? briefing ?? null,
    summary: parsed?.brief_summary ?? null,
    payload: parsed ?? {},
    model: model ?? null,
    promptVersion: PROMPT_VERSION,
    tokensUsed: tokensUsed ?? null,
  };
}

// ---------------------------------------------------------------------------
// LLM wiring
// ---------------------------------------------------------------------------

/** Resolve the model id for a tenant: MofuIntegration.insightModel || env || default. */
export async function resolveModel(prisma, tenantId) {
  let mofu = null;
  try {
    mofu = await getMofuIntegration(prisma, tenantId);
  } catch {
    mofu = null;
  }
  return mofu?.insightModel || ANTHROPIC_MODEL_SIMPLE;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

// ---------------------------------------------------------------------------
// per-step recompute
// ---------------------------------------------------------------------------

/**
 * Run the COMPANY (account) briefing prompt over deal context and store a
 * DealInsight; denormalize deal.score. Returns the created DealInsight (or null).
 */
export async function recomputeDealInsight(prisma, tenantId, dealId, { llm, token, fetchImpl } = {}) {
  const client = llm ?? getAnthropicClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleDealContext(prisma, tenantId, dealId, { token, fetchImpl });
  if (!vars) return null;

  const user = fillTemplate(COMPANY_USER, { ...vars, ontology: ONTOLOGY });
  const { data, tokensUsed } = await runJsonPrompt({ llm: client, model, system: COMPANY_SYSTEM, user });
  if (!data) return null;

  const insight = await prisma.dealInsight.create({
    data: buildDealInsightData(tenantId, dealId, data, { model, tokensUsed }),
  });

  const score = toInt(data?.account_score);
  if (score !== null) {
    try {
      await prisma.deal.update({ where: { id: dealId }, data: { score } });
    } catch {
      /* denormalization is best-effort */
    }
  }
  return insight;
}

/**
 * Run the SIGNAL prompt over the deal's engagements and upsert Signal rows.
 * Skips entirely when there are no engagements. Returns the created Signals.
 */
export async function recomputeSignals(prisma, tenantId, dealId, { llm, token, fetchImpl } = {}) {
  const client = llm ?? getAnthropicClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleDealContext(prisma, tenantId, dealId, { token, fetchImpl });
  if (!vars) return [];
  if (!arr(vars.engagements).length) return [];

  const user = fillTemplate(SIGNAL_USER, { ...vars, ontology: ONTOLOGY });
  const { data } = await runJsonPrompt({ llm: client, model, system: SIGNAL_SYSTEM, user });
  let signals = arr(data?.signals);
  if (!signals.length) {
    signals = bootstrapSignalsFromTofuCampaign(vars.campaignContext);
  }
  if (!signals.length) return [];

  const accountId = vars._accountId ?? null;
  const created = [];
  for (const sig of signals) {
    try {
      const row = await prisma.signal.create({
        data: buildSignalData(tenantId, dealId, accountId, sig),
      });
      created.push(row);
    } catch {
      /* skip a malformed signal, keep the rest */
    }
  }
  return created;
}

/**
 * Run the NBA prompt over the deal's top signals and create NbaRecommendation
 * rows (the spec produces exactly 2). Returns the created NBAs.
 */
export async function recomputeNbas(prisma, tenantId, dealId, { llm, token, fetchImpl } = {}) {
  const client = llm ?? getAnthropicClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleDealContext(prisma, tenantId, dealId, { token, fetchImpl });
  if (!vars) return [];

  let topSignals = arr(vars.signals)
    .slice()
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, 3);

  if (!topSignals.length) {
    const boot = bootstrapSignalsFromTofuCampaign(vars.campaignContext);
    topSignals = boot.slice(0, 3);
  }

  const user = fillTemplate(NBA_USER, { ...vars, signals: topSignals, ontology: ONTOLOGY });
  const { data } = await runJsonPrompt({ llm: client, model, system: NBA_SYSTEM, user });
  let actions = arr(data?.nba_action);
  if (!actions.length && topSignals.length) {
    actions = [
      {
        action_title: "Follow up on qualified outreach lead",
        core_action: "Draft a personalized follow-up email referencing the TOFU campaign conversation",
        action_verb: "Sales::Follow_Up",
        action_score: "85",
        justification: "Contact qualified in Clarwiz outreach; continue the conversation toward a meeting.",
      },
      {
        action_title: "Schedule discovery call",
        core_action: "Invite the champion to book a discovery meeting",
        action_verb: "Sales::Schedule_Meeting",
        action_score: "80",
        justification: "Qualified lead with prior engagement — move to live conversation.",
      },
    ];
  }
  if (!actions.length) return [];

  const created = [];
  for (const nba of actions) {
    try {
      const row = await prisma.nbaRecommendation.create({
        data: buildNbaData(tenantId, dealId, nba),
      });
      created.push(row);
    } catch {
      /* skip a malformed action, keep the rest */
    }
  }
  return created;
}

/**
 * Orchestrate a full deal recompute: signals → nbas → dealInsight, each
 * independently fault-isolated. Logs INSIGHT_COMPUTED. Returns a summary.
 */
export async function recomputeDeal(prisma, tenantId, dealId, { llm, token, fetchImpl } = {}) {
  const summary = { dealId, signals: 0, nbas: 0, insight: false, errors: [] };

  // Resolve the deal's HubSpot object id once (best-effort) for the action log.
  let hsObjectId = null;
  try {
    const ctx = await assembleDealContext(prisma, tenantId, dealId, { token, fetchImpl });
    hsObjectId = ctx?._hsObjectId ?? null;
  } catch {
    /* ignore */
  }

  try {
    const sigs = await recomputeSignals(prisma, tenantId, dealId, { llm, token, fetchImpl });
    summary.signals = sigs.length;
  } catch (err) {
    summary.errors.push(`signals: ${err.message}`);
  }

  try {
    const nbas = await recomputeNbas(prisma, tenantId, dealId, { llm, token, fetchImpl });
    summary.nbas = nbas.length;
  } catch (err) {
    summary.errors.push(`nbas: ${err.message}`);
  }

  let insight = null;
  try {
    insight = await recomputeDealInsight(prisma, tenantId, dealId, { llm, token, fetchImpl });
    summary.insight = !!insight;
  } catch (err) {
    summary.errors.push(`insight: ${err.message}`);
  }

  await logAssistAction(prisma, {
    tenantId,
    entityType: "deal",
    hsObjectId,
    action: "INSIGHT_COMPUTED",
    payload: summary,
  });

  return summary;
}

/**
 * Company-level recompute: assemble account context → COMPANY prompt → store a
 * CompanyInsight row. Logs INSIGHT_COMPUTED. Returns the CompanyInsight (or null).
 */
export async function recomputeCompany(prisma, tenantId, accountId, { llm, token, fetchImpl } = {}) {
  const client = llm ?? getAnthropicClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleCompanyContext(prisma, tenantId, accountId, { token, fetchImpl });
  if (!vars) return null;

  const user = fillTemplate(COMPANY_USER, { ...vars, ontology: ONTOLOGY });
  const { data, tokensUsed } = await runJsonPrompt({ llm: client, model, system: COMPANY_SYSTEM, user });
  if (!data) {
    await logAssistAction(prisma, {
      tenantId,
      entityType: "account",
      action: "INSIGHT_COMPUTED",
      payload: { accountId, insight: false },
    });
    return null;
  }

  const insight = await prisma.companyInsight.create({
    data: {
      tenantId,
      accountId,
      payload: data,
      model,
      promptVersion: PROMPT_VERSION,
      tokensUsed: tokensUsed ?? null,
    },
  });

  await logAssistAction(prisma, {
    tenantId,
    entityType: "account",
    action: "INSIGHT_COMPUTED",
    payload: { accountId, insight: true },
  });

  return insight;
}

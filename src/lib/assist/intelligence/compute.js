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
import { getOpenAIClient } from "@/lib/openaiClient";
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

/** Shape a Signal create-payload from one AURA signal object (no DB write). */
export function buildSignalData(tenantId, dealId, accountId, sig) {
  const type = sig?.signal_type ?? "Unknown::Signal";
  return {
    tenantId,
    dealId: dealId ?? null,
    accountId: accountId ?? null,
    type,
    category: categoryOf(type),
    score: toInt(sig?.signal_score),
    confidence: toInt(sig?.confidence),
    headline: sig?.context || sig?.signal_type || "Signal",
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
  return mofu?.insightModel || process.env.OPENAI_MODEL_SIMPLE || "gpt-4o-mini";
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
export async function recomputeDealInsight(prisma, tenantId, dealId, { llm } = {}) {
  const client = llm ?? getOpenAIClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleDealContext(prisma, tenantId, dealId);
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
export async function recomputeSignals(prisma, tenantId, dealId, { llm } = {}) {
  const client = llm ?? getOpenAIClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleDealContext(prisma, tenantId, dealId);
  if (!vars) return [];
  if (!arr(vars.engagements).length) return [];

  const user = fillTemplate(SIGNAL_USER, { ...vars, ontology: ONTOLOGY });
  const { data } = await runJsonPrompt({ llm: client, model, system: SIGNAL_SYSTEM, user });
  const signals = arr(data?.signals);
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
export async function recomputeNbas(prisma, tenantId, dealId, { llm } = {}) {
  const client = llm ?? getOpenAIClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleDealContext(prisma, tenantId, dealId);
  if (!vars) return [];

  const topSignals = arr(vars.signals)
    .slice()
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, 3);

  const user = fillTemplate(NBA_USER, { ...vars, signals: topSignals, ontology: ONTOLOGY });
  const { data } = await runJsonPrompt({ llm: client, model, system: NBA_SYSTEM, user });
  const actions = arr(data?.nba_action);
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
export async function recomputeDeal(prisma, tenantId, dealId, { llm } = {}) {
  const summary = { dealId, signals: 0, nbas: 0, insight: false, errors: [] };

  // Resolve the deal's HubSpot object id once (best-effort) for the action log.
  let hsObjectId = null;
  try {
    const ctx = await assembleDealContext(prisma, tenantId, dealId);
    hsObjectId = ctx?._hsObjectId ?? null;
  } catch {
    /* ignore */
  }

  try {
    const sigs = await recomputeSignals(prisma, tenantId, dealId, { llm });
    summary.signals = sigs.length;
  } catch (err) {
    summary.errors.push(`signals: ${err.message}`);
  }

  try {
    const nbas = await recomputeNbas(prisma, tenantId, dealId, { llm });
    summary.nbas = nbas.length;
  } catch (err) {
    summary.errors.push(`nbas: ${err.message}`);
  }

  let insight = null;
  try {
    insight = await recomputeDealInsight(prisma, tenantId, dealId, { llm });
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
export async function recomputeCompany(prisma, tenantId, accountId, { llm } = {}) {
  const client = llm ?? getOpenAIClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleCompanyContext(prisma, tenantId, accountId);
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

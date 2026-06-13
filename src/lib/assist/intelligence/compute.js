/**
 * F2 Intelligence Core — computes & PERSISTS AURA insights IN-CLARWIZ.
 *
 * Pipeline per deal: assemble context → run AURA prompts (signal / nba /
 * company) through an injectable LLM → normalize the model's JSON → write
 * Signal / NbaRecommendation / DealInsight rows. recomputeDeal orchestrates all
 * three with independent try/catch so one failing LLM call can't sink the rest,
 * then refreshes CompanyInsight for every account tied to the deal.
 *
 * The COMPANY prompt is the account briefing; it ALSO drives the deal-level
 * insight (account_score, gtm paths, early warnings, coaching) — there is no
 * separate "deal" prompt in the AURA spec.
 */
import { getMofuIntegration } from "@/lib/assist/mofuIntegration";
import { syncDealRecordings } from "@/lib/assist/hubspotRecordings.js";
import { ensureRecordingSetupNbaForDeal } from "@/lib/assist/recordingSetupNba.js";
import { getAnthropicClient, ANTHROPIC_MODEL_SIMPLE } from "@/lib/anthropicClient";
import { logAssistAction } from "@/lib/assist/logAction";
import { assembleDealContext, assembleCompanyContext } from "@/lib/assist/context/assembleContext.js";
import {
  fillTemplate,
  SIGNAL_SYSTEM,
  SIGNAL_USER,
  SIGNAL_SYSTEM_SLIM,
  SIGNAL_USER_SLIM,
  NBA_SYSTEM,
  NBA_USER,
  COMPANY_SYSTEM,
  COMPANY_USER,
  COMPANY_SYSTEM_SLIM,
  COMPANY_USER_SLIM,
} from "@/lib/assist/prompts/index.js";
import { ONTOLOGY, PROMPT_VERSION } from "@/lib/assist/prompts/ontology.js";
import {
  runJsonPrompt,
  extractSignalsPayload,
  extractNbaPayload,
  salvageAuraJson,
} from "./runner.js";

const ONTOLOGY_SLIM =
  ONTOLOGY.length > 5000 ? `${ONTOLOGY.slice(0, 5000)}\n...[ontology truncated]` : ONTOLOGY;

const DEFAULT_NBA_FALLBACKS = [
  {
    action_title: "Follow up on qualified outreach lead",
    core_action: "Draft a personalized follow-up email referencing the TOFU campaign conversation",
    action_verb: "Sales::Follow_Up",
    action_score: "85",
    justification: "Contact engaged in Clarwiz outreach; continue the conversation toward a meeting.",
  },
  {
    action_title: "Schedule discovery call",
    core_action: "Invite the champion to book a discovery meeting",
    action_verb: "Sales::Schedule_Meeting",
    action_score: "80",
    justification: "Active engagement — move to live conversation.",
  },
];

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

/** Heuristic signals from raw engagement rows when the LLM returns nothing. */
export function bootstrapSignalsFromEngagements(engagements = []) {
  const signals = [];
  for (const e of engagements) {
    if (e?.responseContent?.trim()) {
      signals.push({
        signal_type: "Behavior::Positive_Reply",
        signal_score: "78",
        confidence: "75",
        context: "Prospect replied during outreach.",
        supporting_quote_customer: String(e.responseContent).trim().slice(0, 500),
        raised_by: e.channel ? `${e.channel} reply` : "Prospect",
      });
    }
  }
  const outbound = engagements.find((e) => e?.message?.trim() && e?.ctaType === "book_demo");
  if (outbound) {
    signals.push({
      signal_type: "Intent::Demo_Request",
      signal_score: "72",
      confidence: "70",
      context: "Outreach included a demo booking CTA.",
      supporting_quote_ae: String(outbound.message).trim().slice(0, 500),
    });
  }
  return signals.slice(0, 5);
}

/** Shrink prompt inputs so large deals stay within model context without losing recent history. */
export function shrinkPromptVars(vars) {
  if (!vars) return vars;
  const trimText = (v, max = 1800) =>
    typeof v === "string" && v.length > max ? `${v.slice(0, max)}…` : v;

  return {
    ...vars,
    ontology: ONTOLOGY_SLIM,
    engagements: arr(vars.engagements)
      .slice(0, 18)
      .map((e) => ({
        ...e,
        message: trimText(e.message),
        text: trimText(e.text),
        content: trimText(e.content),
        responseContent: trimText(e.responseContent),
      })),
    campaignContext: arr(vars.campaignContext).map((cc) => ({
      ...cc,
      commLogs: arr(cc.commLogs)
        .slice(-12)
        .map((l) => ({
          ...l,
          message: trimText(l.message, 1200),
          responseContent: trimText(l.responseContent, 1200),
        })),
    })),
  };
}

function collectBootstrapSignals(vars) {
  const seen = new Set();
  const out = [];
  for (const sig of [
    ...bootstrapSignalsFromTofuCampaign(vars.campaignContext),
    ...bootstrapSignalsFromEngagements(vars.engagements),
  ]) {
    const key = `${sig.signal_type}:${sig.context}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sig);
  }
  return out;
}

async function persistSignals(prisma, tenantId, dealId, accountId, signals) {
  const created = [];
  for (const sig of signals) {
    try {
      const row = await prisma.signal.create({
        data: buildSignalData(tenantId, dealId, accountId, sig),
      });
      created.push(row);
    } catch (err) {
      console.warn(`[MOFU] signal persist skipped deal=${dealId}: ${err.message}`);
    }
  }
  return created;
}

async function extractSignalsWithLlm(client, model, vars) {
  const promptVars = shrinkPromptVars(vars);

  const slim = await runJsonPrompt({
    llm: client,
    model,
    system: SIGNAL_SYSTEM_SLIM,
    user: fillTemplate(SIGNAL_USER_SLIM, { ...promptVars, ontology: ONTOLOGY_SLIM }),
  });
  let signals = extractSignalsPayload(slim.data, slim.raw);
  if (signals.length) return signals;

  const full = await runJsonPrompt({
    llm: client,
    model,
    system: SIGNAL_SYSTEM,
    user: fillTemplate(SIGNAL_USER, { ...promptVars, ontology: ONTOLOGY }),
  });
  signals = extractSignalsPayload(full.data, full.raw);
  if (signals.length) return signals;

  if (full.truncated || slim.truncated) {
    const salvaged = salvageAuraJson(full.raw || slim.raw || "");
    if (Array.isArray(salvaged?.signals) && salvaged.signals.length) {
      return salvaged.signals;
    }
  }
  return [];
}

async function extractInsightWithLlm(client, model, vars) {
  const promptVars = shrinkPromptVars(vars);

  const slim = await runJsonPrompt({
    llm: client,
    model,
    system: COMPANY_SYSTEM_SLIM,
    user: fillTemplate(COMPANY_USER_SLIM, { ...promptVars, ontology: ONTOLOGY_SLIM }),
  });
  if (slim.data?.your_coach_speaks || slim.data?.brief_summary || slim.data?.account_score) {
    return { data: slim.data, tokensUsed: slim.tokensUsed };
  }

  const full = await runJsonPrompt({
    llm: client,
    model,
    system: COMPANY_SYSTEM,
    user: fillTemplate(COMPANY_USER, { ...promptVars, ontology: ONTOLOGY }),
  });
  if (full.data) return { data: full.data, tokensUsed: full.tokensUsed };

  const salvaged = salvageAuraJson(full.raw || slim.raw || "");
  if (salvaged?.your_coach_speaks || salvaged?.brief_summary || salvaged?.account_score) {
    return { data: salvaged, tokensUsed: full.tokensUsed ?? slim.tokensUsed };
  }
  return { data: null, tokensUsed: full.tokensUsed ?? slim.tokensUsed };
}

function buildMinimalDealInsightData(tenantId, dealId, vars) {
  const name = vars?.dealData?.name || vars?.companyData?.name || "this deal";
  return {
    tenantId,
    dealId,
    score: 55,
    briefing:
      "Engagement data is limited. Review recent outreach, confirm stakeholders, and schedule a discovery call to advance the deal.",
    summary: `${name} — run a follow-up while momentum from outreach is still warm.`,
    payload: { source: "bootstrap", dealName: name },
    promptVersion: PROMPT_VERSION,
  };
}

/** User-facing summary for a deal recompute result. */
export function formatRecomputeSummary(summary) {
  if (!summary) return "Intelligence refreshed";
  const parts = [];
  if (summary.signals > 0) parts.push(`${summary.signals} signal${summary.signals === 1 ? "" : "s"}`);
  if (summary.nbas > 0) parts.push(`${summary.nbas} NBA${summary.nbas === 1 ? "" : "s"}`);
  if (summary.insight) parts.push("briefing");
  if (summary.companyInsights > 0) {
    parts.push(
      `${summary.companyInsights} company brief${summary.companyInsights === 1 ? "" : "s"}`
    );
  }
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
// deal → account resolution
// ---------------------------------------------------------------------------

/** All tenant Account ids linked to a deal (primary account + contact companies). */
export async function resolveDealAccountIds(prisma, tenantId, dealId) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    select: {
      accountId: true,
      dealContacts: {
        select: {
          contact: {
            select: {
              businessUser: { select: { companyId: true } },
            },
          },
        },
      },
    },
  });
  if (!deal) return [];

  const accountIds = new Set();
  if (deal.accountId) accountIds.add(deal.accountId);

  const companyIds = [
    ...new Set(
      deal.dealContacts.map((dc) => dc.contact?.businessUser?.companyId).filter(Boolean)
    ),
  ];

  if (companyIds.length) {
    const accounts = await prisma.account.findMany({
      where: { tenantId, companyId: { in: companyIds } },
      select: { id: true },
    });
    for (const a of accounts) accountIds.add(a.id);
  }

  return [...accountIds];
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

  let { data, tokensUsed } = await extractInsightWithLlm(client, model, vars);
  let rowData;
  if (!data) {
    rowData = buildMinimalDealInsightData(tenantId, dealId, vars);
  } else {
    rowData = buildDealInsightData(tenantId, dealId, data, { model, tokensUsed });
  }

  const insight = await prisma.dealInsight.create({
    data: rowData,
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

  const bootstrap = collectBootstrapSignals(vars);
  let signals = [];

  if (arr(vars.engagements).length) {
    signals = await extractSignalsWithLlm(client, model, vars);
  }

  if (!signals.length) signals = bootstrap;
  else if (bootstrap.length) {
    const seen = new Set(signals.map((s) => `${s.signal_type}:${s.context}`));
    for (const sig of bootstrap) {
      const key = `${sig.signal_type}:${sig.context}`;
      if (!seen.has(key)) signals.push(sig);
    }
  }

  if (!signals.length) return [];

  return persistSignals(prisma, tenantId, dealId, vars._accountId ?? null, signals);
}

/**
 * Run the NBA prompt over the deal's top signals and create NbaRecommendation
 * rows (prompt asks for as many as warranted, up to 20 — no server-side cap).
 * Returns the created NBAs.
 */
export async function recomputeNbas(prisma, tenantId, dealId, { llm, token, fetchImpl } = {}) {
  const client = llm ?? getAnthropicClient();
  const model = await resolveModel(prisma, tenantId);
  const vars = await assembleDealContext(prisma, tenantId, dealId, { token, fetchImpl });
  if (!vars) return [];

  const storedSignals = await prisma.signal.findMany({
    where: { tenantId, dealId },
    orderBy: { score: "desc" },
    take: 5,
  });

  let topSignals = storedSignals.length
    ? storedSignals.map((s) => ({ ...s.payload, signal_score: s.score, signal_type: s.type }))
    : arr(vars.signals)
        .slice()
        .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
        .slice(0, 3);

  if (!topSignals.length) {
    topSignals = collectBootstrapSignals(vars).slice(0, 3);
  }

  const promptVars = shrinkPromptVars(vars);
  const user = fillTemplate(NBA_USER, { ...promptVars, signals: topSignals, ontology: ONTOLOGY_SLIM });
  const nbaRes = await runJsonPrompt({ llm: client, model, system: NBA_SYSTEM, user });
  let actions = extractNbaPayload(nbaRes.data, nbaRes.raw);
  if (!actions.length && topSignals.length) {
    actions = DEFAULT_NBA_FALLBACKS;
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
 * Orchestrate a full deal recompute: signals → nbas → dealInsight → company
 * insights for linked accounts, each independently fault-isolated.
 * Logs INSIGHT_COMPUTED. Returns a summary.
 */
export async function recomputeDeal(prisma, tenantId, dealId, { llm, token, fetchImpl } = {}) {
  const summary = {
    dealId,
    signals: 0,
    nbas: 0,
    setupNba: false,
    insight: false,
    companyInsights: 0,
    errors: [],
  };

  // Resolve the deal's HubSpot object id once (best-effort) for the action log.
  let hsObjectId = null;
  try {
    const ctx = await assembleDealContext(prisma, tenantId, dealId, { token, fetchImpl });
    hsObjectId = ctx?._hsObjectId ?? null;
  } catch {
    /* ignore */
  }

  // Refresh HubSpot meetings/calls so recorder gaps are visible before signals/NBAs.
  if (token) {
    try {
      const mofu = await getMofuIntegration(prisma, tenantId).catch(() => null);
      const scopes = mofu?.hubspotScopes ?? [];
      await syncDealRecordings(prisma, tenantId, dealId, { token, scopes, fetchImpl });
      summary.setupNba = await ensureRecordingSetupNbaForDeal(prisma, tenantId, dealId);
    } catch (err) {
      summary.errors.push(`recording_setup: ${err.message}`);
    }
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

  const accountIds = await resolveDealAccountIds(prisma, tenantId, dealId);
  for (const accountId of accountIds) {
    try {
      const companyInsight = await recomputeCompany(prisma, tenantId, accountId, {
        llm,
        token,
        fetchImpl,
      });
      if (companyInsight) summary.companyInsights += 1;
    } catch (err) {
      summary.errors.push(`company:${accountId}: ${err.message}`);
    }
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

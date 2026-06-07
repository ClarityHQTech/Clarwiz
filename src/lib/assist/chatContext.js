/**
 * Pure context-builder for the AE Chat Dock (C1).
 *
 * `buildSnapshot(view)` compacts a deal / company / dashboard view-model (from
 * insightsReader) into a small, bounded JSON grounding object — ids, names,
 * stages, scores and the top few signals/NBAs only. No raw `payload` blobs,
 * no huge insight bodies. Safe for null/undefined views.
 *
 * `buildChatSystemPrompt({ pageContext, snapshot })` returns a system message
 * string that frames the assistant as a GTM AE copilot and embeds the snapshot
 * plus the current page context (entity type + name).
 *
 * Both functions are PURE (no I/O) so they can be unit-tested in isolation.
 */

const MAX_SIGNALS = 5;
const MAX_NBAS = 5;
const MAX_DEALS = 8;
const MAX_CONTACTS = 6;
const TEXT_CLAMP = 160;

function clamp(value, max = TEXT_CLAMP) {
  if (value == null) return undefined;
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compactCompany(company) {
  if (!company) return undefined;
  return {
    id: company.id,
    name: company.name,
    domain: company.domain ?? undefined,
    industry: company.industry ?? undefined,
  };
}

function compactSignal(s) {
  return {
    id: s.id,
    headline: clamp(s.headline),
    category: s.category ?? undefined,
    type: s.type ?? undefined,
    score: num(s.score),
  };
}

function compactNba(n) {
  return {
    id: n.id,
    title: clamp(n.title),
    actionType: n.actionType ?? undefined,
    status: n.status ?? undefined,
    score: num(n.score),
  };
}

function compactDeal(d) {
  return {
    id: d.id,
    name: clamp(d.name, 80),
    stage: d.stageLabel ?? undefined,
    amount: num(d.amount),
    status: d.status ?? undefined,
    score: num(d.score),
  };
}

function compactContact(c) {
  return {
    id: c.id,
    name: clamp(c.name, 80),
    jobTitle: c.jobTitle ?? undefined,
  };
}

function byScoreDesc(a, b) {
  return (num(b.score) ?? -1) - (num(a.score) ?? -1);
}

function topBy(list, n) {
  if (!Array.isArray(list)) return [];
  return [...list].sort(byScoreDesc).slice(0, n);
}

/**
 * Detect which view-model shape we were handed and compact it.
 * @param {object|null|undefined} view
 * @returns {object} compact, bounded snapshot
 */
export function buildSnapshot(view) {
  if (!view) return { kind: "empty" };

  // Deal Workroom view: { deal, account, company, contacts, insight, nbas, signals }
  if (view.deal && !Array.isArray(view.deals)) {
    const d = view.deal;
    return {
      kind: "deal",
      deal: {
        id: d.id,
        hsId: d.hubspotDealId ?? undefined,
        name: clamp(d.name, 120),
        stage: d.stageLabel ?? undefined,
        amount: num(d.amount),
        status: d.status ?? undefined,
        score: num(d.score),
      },
      company: compactCompany(view.company),
      insightSummary: clamp(view.insight?.summary ?? view.insight?.briefing, 400),
      contacts: (view.contacts ?? []).slice(0, MAX_CONTACTS).map(compactContact),
      topSignals: topBy(view.signals, MAX_SIGNALS).map(compactSignal),
      topNbas: topBy(view.nbas, MAX_NBAS).map(compactNba),
    };
  }

  // Company Workroom view: { account, company, insight, signals, deals, contacts }
  if (view.account && Array.isArray(view.deals)) {
    return {
      kind: "company",
      account: {
        id: view.account.id,
        hsId: view.account.hubspotCompanyId ?? undefined,
        lifecycleStage: view.account.lifecycleStage ?? undefined,
      },
      company: compactCompany(view.company),
      contacts: (view.contacts ?? []).slice(0, MAX_CONTACTS).map(compactContact),
      deals: (view.deals ?? []).slice(0, MAX_DEALS).map(compactDeal),
      topSignals: topBy(view.signals, MAX_SIGNALS).map(compactSignal),
    };
  }

  // Dashboard view: { deals, leads, accounts }
  if (Array.isArray(view.deals)) {
    return {
      kind: "dashboard",
      pipeline: {
        openDeals: view.deals.length,
        leads: Array.isArray(view.leads) ? view.leads.length : 0,
        accounts: Array.isArray(view.accounts) ? view.accounts.length : 0,
      },
      topDeals: topBy(view.deals, MAX_DEALS).map(compactDeal),
    };
  }

  return { kind: "empty" };
}

/**
 * @param {{ pageContext?: {entityType?: string, id?: string, name?: string}, snapshot: object }} args
 * @returns {string} system prompt
 */
export function buildChatSystemPrompt({ pageContext, snapshot } = {}) {
  const ctx = pageContext ?? {};
  const entityType = ctx.entityType ?? "pipeline";
  const entityName = ctx.name ? clamp(ctx.name, 120) : null;
  const snap = snapshot ?? { kind: "empty" };

  const focusLine = entityName
    ? `The AE is currently viewing the ${entityType} "${entityName}".`
    : `The AE is currently viewing their ${entityType} overview.`;

  return [
    "You are Clarwiz AE Assist, a GTM copilot embedded in the seller's CRM workspace.",
    "You help account executives understand and act on their deals, accounts, buying signals and next best actions.",
    "Ground every answer in the CRM CONTEXT snapshot below. If the snapshot lacks the information, say so plainly and suggest where the AE can find it — never invent deal facts, amounts, names or signals.",
    "Be concise, specific and action-oriented: lead with the recommendation, then the why. Use the AE's own data (stages, scores, signals, NBAs) when relevant.",
    "",
    focusLine,
    "",
    "CRM CONTEXT (JSON):",
    JSON.stringify(snap),
  ].join("\n");
}

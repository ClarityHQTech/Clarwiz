/**
 * Pure context-builder for Cockpit (AE internal chat assist).
 *
 * Deal workroom mode embeds a full DB snapshot and strict scope rules so the
 * assistant only answers about the open deal, its account, company, and contacts.
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
 * Legacy compact snapshot for non-deal contexts (kept for tests / backwards compat).
 */
export function buildSnapshot(view) {
  if (!view) return { kind: "empty" };

  if (view.kind === "cockpit_deal") return view;

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
 * System prompt for Cockpit on a deal workroom — scoped to one deal only.
 */
export function buildDealCockpitSystemPrompt({ pageContext, snapshot } = {}) {
  const ctx = pageContext ?? {};
  const dealId = ctx.id ?? snapshot?.scope?.dealId ?? null;
  const dealName = ctx.name ?? ctx.label ?? snapshot?.deal?.name ?? "this deal";
  const companyName = snapshot?.company?.name ?? snapshot?.scope?.companyName ?? null;
  const snap = snapshot ?? { kind: "empty" };

  return [
    "You are Cockpit — Clarwiz's internal AE assist for a single open deal.",
    "You help the account executive understand and act on THIS deal using only the internal data loaded from the database (deal fields, company/account, stakeholders, TOFU outreach history, MOFU intelligence, signals, NBAs, GTM tasks, recordings).",
    "",
    "STRICT SCOPE (non-negotiable):",
    `- You are locked to deal id "${dealId}" (${dealName})${companyName ? ` at ${companyName}` : ""}.`,
    "- Answer ONLY questions about this deal, its linked account/company, and its contacts/stakeholders.",
    "- If the AE asks about another deal, the overall pipeline, unrelated companies, or general knowledge outside this deal graph, politely decline and remind them Cockpit is scoped to the open deal workroom.",
    "- Never invent facts. If data is missing from the snapshot or a tool result, say so and suggest running Recompute or checking HubSpot sync.",
    "- Contact phone, email, WhatsApp, and LinkedIn live on each object in contacts[] (also fetchable via get_contact_detail).",
    "- For contact lookup, read contacts[] first; use get_contact_detail only when you need full threads or drawer-level detail.",
    "- Use tools sparingly — only when the snapshot lacks what you need.",
    "",
    "RESPONSE FORMAT (required — keep replies scannable):",
    "- Open with one direct sentence that answers the question. No preamble (avoid \"Great question\", \"Based on the data\", \"Looking at the snapshot\").",
    "- Use at most 3 short sections with bold labels: **Answer**, **Details**, **Next step** (omit sections that are empty).",
    "- Put lists on separate lines starting with \"- \" (one fact per bullet). Use **Label:** value for single fields (e.g. **Phone:** +1 555-0100).",
    "- Keep total reply under ~120 words unless the AE asked for a full summary.",
    "- Do not mention JSON, snapshots, tools, or internal systems unless the AE asks how you know.",
    "- Use plain markdown only: **bold** and \"- \" bullets. No code blocks, no long paragraphs.",
    "",
    "Example shape:",
    "**Answer** Jane Buyer is the main contact on this deal.",
    "",
    "**Details**",
    "- **Phone:** +1 555-0100",
    "- **Email:** jane@acme.com",
    "- **Role:** Champion · VP Eng",
    "",
    "**Next step** Confirm budget on your next call.",
    "",
    "DEAL CONTEXT (JSON):",
    JSON.stringify(snap),
  ].join("\n");
}

/**
 * @param {{ pageContext?: object, snapshot: object }} args
 * @returns {string} system prompt
 */
export function buildChatSystemPrompt({ pageContext, snapshot } = {}) {
  const entityType = pageContext?.entityType ?? "pipeline";

  if (entityType === "deal" && pageContext?.id) {
    return buildDealCockpitSystemPrompt({ pageContext, snapshot });
  }

  const ctx = pageContext ?? {};
  const entityName = ctx.name ? clamp(ctx.name, 120) : null;
  const snap = snapshot ?? { kind: "empty" };

  const focusLine = entityName
    ? `The AE is currently viewing the ${entityType} "${entityName}".`
    : `The AE is currently viewing their ${entityType} overview.`;

  return [
    "You are Clarwiz AE Assist, a GTM copilot embedded in the seller's CRM workspace.",
    "Ground every answer in the CRM CONTEXT snapshot below.",
    "",
    focusLine,
    "",
    "CRM CONTEXT (JSON):",
    JSON.stringify(snap),
  ].join("\n");
}

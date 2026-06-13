/**
 * Pure view-model mapper for the Deal Workroom (W1).
 *
 * Flattens the output of `getDealView` (deal + account + company + contacts +
 * DealInsight.payload + nbas + signals) into a single null-safe object the UI
 * can render directly. Every AURA payload field is optional, so each accessor
 * defaults defensively — the UI should never have to guard against `undefined`.
 *
 * This module is intentionally side-effect free and dependency-free so it can be
 * unit-tested in isolation.
 */

import { mapGtmTasksByStepKey } from "@/lib/assist/gtmTaskbook";

function asString(v) {
  return typeof v === "string" && v.trim() ? v : null;
}

function asDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dealPayloadField(payload, key) {
  if (!payload || typeof payload !== "object") return null;
  return asString(payload[key]);
}

function mapAccount(raw) {
  if (!raw || typeof raw !== "object") return null;
  const company = raw.company && typeof raw.company === "object" ? raw.company : null;
  return {
    id: raw.id ?? null,
    hubspotCompanyId: asString(raw.hubspotCompanyId),
    lifecycleStage: asString(raw.lifecycleStage),
    ownerId: asString(raw.ownerId),
    syncedAt: asDate(raw.syncedAt),
    company: company
      ? {
          id: company.id ?? null,
          name: asString(company.name),
          domain: asString(company.domain),
          industry: asString(company.industry),
        }
      : null,
  };
}

function mapCompany(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: raw.id ?? null,
    name: asString(raw.name),
    domain: asString(raw.domain),
    industry: asString(raw.industry),
  };
}

function asNumber(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function pluck(rows, key) {
  return asArray(rows)
    .map((r) => (r && typeof r === "object" ? asString(r[key]) : null))
    .filter(Boolean);
}

function stringList(v) {
  return asArray(v).filter((s) => typeof s === "string" && s.trim());
}

function mapGtmPaths(raw) {
  return asArray(raw)
    .filter((p) => p && typeof p === "object")
    .map((p, i) => ({
      index: i,
      title: asString(p.title) ?? `Path ${i + 1}`,
      scoreImpact: asNumber(p.score_impact),
      steps: stringList(p.path_steps),
      whyThisWorks: asString(p.why_this_works),
    }));
}

function mapContacts(raw) {
  return asArray(raw).map((c) => {
    const bu = c?.businessUser ?? null;
    return {
      id: c?.id ?? null,
      email: asString(bu?.email) ?? asString(c?.email),
      name: asString(bu?.name) ?? asString(bu?.email) ?? asString(c?.email) ?? "Unknown contact",
      title: asString(bu?.jobTitle),
      persona: asString(c?.persona),
      lifecycleStage: asString(c?.lifecycleStage),
      phone: asString(bu?.phone),
      companyName: asString(bu?.company?.name),
      tofuScore: asNumber(c?.tofuScore),
      tofuStatus: asString(c?.tofuStatus),
      tofuQualifiedReason: asString(c?.tofuQualifiedReason),
      campaignName: asString(c?.campaignName),
      tofuCommCount: asNumber(c?.tofuCommCount),
      businessUser: bu,
    };
  });
}

/**
 * @param {object|null} view result of getDealView (may be null)
 * @returns flat, null-safe view model
 */
export function toDealViewModel(view) {
  const v = view && typeof view === "object" ? view : {};
  const d = v.deal && typeof v.deal === "object" ? v.deal : null;
  const insight = v.insight && typeof v.insight === "object" ? v.insight : null;
  const payload = insight && insight.payload && typeof insight.payload === "object" ? insight.payload : {};

  const detected =
    payload.aura_insight_detected && typeof payload.aura_insight_detected === "object"
      ? payload.aura_insight_detected
      : {};

  const nbaRaw =
    payload.recommended_next_best_actions && typeof payload.recommended_next_best_actions === "object"
      ? payload.recommended_next_best_actions
      : {};

  const deal = d
    ? {
        id: d.id ?? null,
        hubspotDealId: d.hubspotDealId ?? null,
        name: asString(d.name) ?? "Untitled deal",
        stageLabel: asString(d.stageLabel),
        stageBand: asString(d.stageBand),
        amount: asNumber(d.amount),
        status: asString(d.status),
        score: asNumber(d.score),
        lastActivityAt: d.lastActivityAt ?? null,
        syncedAt: asDate(d.syncedAt),
        createdAt: asDate(d.createdAt),
        description: dealPayloadField(d.payload, "description"),
        pipeline: dealPayloadField(d.payload, "pipeline"),
        closeDate: asDate(d.payload?.closedate),
        ownerId: asString(d.ownerId) ?? dealPayloadField(d.payload, "hubspot_owner_id"),
      }
    : null;

  return {
    deal,
    account: mapAccount(v.account),
    company: mapCompany(v.company) ?? mapAccount(v.account)?.company ?? null,
    contacts: mapContacts(v.contacts),
    campaignContexts: asArray(v.campaignContexts),

    hasInsight: Boolean(insight),
    insightComputedAt: insight?.computedAt ?? null,
    accountScore: asNumber(payload.account_score),

    briefing: {
      accountLevelBriefing: asString(payload.account_level_briefing),
      briefSummary: asString(payload.brief_summary),
      coachSpeaks: asString(payload.your_coach_speaks),
    },

    insightDetected: {
      label: asString(detected.insight_label),
      explanation: asString(detected.insight_explanation),
    },
    gtmPaths: mapGtmPaths(detected.gtm_paths_you_can_pursue),

    recommendedActions: {
      ae: stringList(nbaRaw.ae),
      system: stringList(nbaRaw.system),
      marketing: stringList(nbaRaw.marketing),
      cs: stringList(nbaRaw.cs),
    },

    likelihoodToProgress: asString(payload.likelihood_to_progress),
    followUpEffort: asString(payload.follow_up_effort),
    positiveOutcomes: pluck(payload.positive_outcomes_observed, "outcome"),
    earlyWarnings: pluck(payload.early_warning_signal, "warning_signal"),
    coachingTip: asString(payload.coaching_tip),

    nbas: asArray(v.nbas),
    signals: asArray(v.signals),
    gtmTasks: mapGtmTasksByStepKey(v.gtmTasks),
  };
}

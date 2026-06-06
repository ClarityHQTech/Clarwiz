import { personaFromTitle } from "@/lib/mofu/directory";

// Assembles an explicit company → contacts → engagements → signals ontology that
// grounds the Heptapod bundle (mirrors how Aura assembles context before generation).
// This is what turns thin context into the rich, multi-level intelligence Aura produces.
export function buildOntology({ deal = null, company = null, contacts = [], engagements = [], signals = [], tenantIcp = null }) {
  const engByContact = {};
  for (const e of engagements) {
    if (e?.contactId) (engByContact[e.contactId] ??= []).push({ kind: e.kind, summary: e.summary, at: e.occurredAt });
  }
  const sigByContact = {};
  for (const s of signals) {
    if (s?.contactId) (sigByContact[s.contactId] ??= []).push({ kind: s.kind, summary: s.summary, score: s.score });
  }

  const contactOntology = contacts.map((c) => {
    const engs = engByContact[c.id] ?? [];
    const lastTouch = engs.map((x) => x.at).filter(Boolean).sort().slice(-1)[0] ?? null;
    return {
      id: c.id,
      name: c.name,
      title: c.title,
      persona: personaFromTitle(c.title),
      engagement_count: engs.length,
      engagements: engs.slice(-5),
      signals: sigByContact[c.id] ?? [],
      last_touch: lastTouch,
    };
  });

  const engagement_timeline = engagements
    .filter((e) => e?.occurredAt)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt))
    .map((e) => ({ kind: e.kind, summary: e.summary, at: e.occurredAt }));

  return {
    deal: deal
      ? { name: deal.name, stage: deal.stage ?? deal.cachedStage, amount: deal.amount ?? deal.cachedAmount, currency: deal.currency ?? deal.cachedCurrency }
      : null,
    company: company
      ? { name: company.name, domain: company.domain, industry: company.industry, employees: company.employees, revenue: company.revenue, location: company.location }
      : null,
    contacts: contactOntology,
    engagement_timeline,
    signals: signals.map((s) => ({ id: s.signalReferenceId, kind: s.kind, summary: s.summary, score: s.score, contactId: s.contactId ?? null })),
    icp: tenantIcp ?? null,
  };
}

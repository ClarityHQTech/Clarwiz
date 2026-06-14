/**
 * Cockpit deal context — loads everything on the deal workroom page from the DB
 * (deal, account, company, contacts, TOFU/MOFU comms, intelligence, signals,
 * NBAs, GTM tasks, recordings) and compacts it for the internal AE chat model.
 */
import {
  getDealView,
  getLatestCompanyInsight,
  getContactView,
} from "@/lib/assist/insightsReader";
import { toDealViewModel } from "@/lib/assist/dealViewModel";
import {
  enrichContactsWithCampaignContext,
  loadCampaignContactContexts,
} from "@/lib/assist/campaignContactContext";
import { buildTofuProspectView } from "@/lib/assist/tofuProspectView";

const TEXT = 280;
const MSG = 400;
const TRANSCRIPT = 1200;
const PAYLOAD_FIELD = 500;

function clamp(v, max = TEXT) {
  if (v == null) return undefined;
  const s = String(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function compactCommLog(log) {
  if (!log) return null;
  return {
    channel: log.channel ?? undefined,
    stage: num(log.stage),
    subject: clamp(log.subject, 120),
    message: clamp(log.message, MSG),
    status: log.status ?? undefined,
    sentAt: log.sentAt ?? undefined,
    responseType: log.responseType ?? undefined,
    response: clamp(log.responseContent, MSG),
  };
}

function compactCommFromProspect(c) {
  return {
    channel: c.channel ?? undefined,
    direction: c.direction ?? undefined,
    subject: clamp(c.subject, 120),
    message: clamp(c.message ?? c.body, MSG),
    status: c.status ?? undefined,
    sentAt: c.sentAt ?? c.createdAt ?? undefined,
  };
}

function compactSignal(s) {
  return {
    id: s.id,
    headline: clamp(s.headline),
    category: s.category ?? undefined,
    type: s.type ?? undefined,
    tier: num(s.tier),
    score: num(s.score),
    evidence: clamp(s.evidence, 200),
    suggestedAngle: clamp(s.suggestedAngle, 200),
  };
}

function compactNba(n) {
  return {
    id: n.id,
    title: clamp(n.title, 120),
    actionType: n.actionType ?? undefined,
    status: n.status ?? undefined,
    score: num(n.score),
    rationale: clamp(n.rationale, 240),
  };
}

function compactCompanyInsightPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    briefSummary: clamp(payload.brief_summary ?? payload.account_level_briefing, PAYLOAD_FIELD),
    accountBriefing: clamp(payload.account_level_briefing, PAYLOAD_FIELD),
    recommendedMove: clamp(payload.recommended_next_best_actions?.ae, 200),
    risks: arr(payload.early_warning_signal)
      .slice(0, 5)
      .map((r) => clamp(r?.warning_signal ?? r, 160))
      .filter(Boolean),
    valueThemes: arr(payload.value_themes_identified)
      .slice(0, 5)
      .map((v) => clamp(typeof v === "string" ? v : v?.theme, 120))
      .filter(Boolean),
  };
}

function roleForContact(dealContacts, contactId) {
  const dc = arr(dealContacts).find((d) => d.contactId === contactId);
  return str(dc?.role);
}

function contactDisplayName(bu, fallbackEmail) {
  if (!bu) return fallbackEmail ?? "Unknown contact";
  const fromParts = [bu.firstName, bu.lastName].filter(Boolean).join(" ");
  return str(bu.name) ?? (fromParts || null) ?? str(bu.email) ?? fallbackEmail ?? "Unknown contact";
}

/**
 * Full stakeholder profile — same fields as the deal workroom contact drawer
 * (BusinessUser + Contact + TOFU prospect fallbacks).
 */
export function buildContactProfile(contact, { dealContacts, campaignContexts, tofuViews } = {}) {
  if (!contact?.id) return null;

  const bu = contact.businessUser ?? {};
  const ctx = arr(campaignContexts).find((cc) => cc.contact?.id === contact.id);
  const tofuView = arr(tofuViews).find((tv) => tv.prospect?.contactId === contact.id);
  const prospect = tofuView?.prospect;

  const recentComms = ctx
    ? arr(ctx.commLogs)
        .slice(-8)
        .map(compactCommLog)
        .filter(Boolean)
    : arr(prospect?.communications)
        .slice(-8)
        .map(compactCommFromProspect)
        .filter(Boolean);

  const tofu =
    ctx || prospect || contact.tofuScore != null || contact.campaignName
      ? {
          campaignContactId: ctx?.id ?? prospect?.id ?? contact.campaignContactId ?? undefined,
          campaignName: ctx?.campaign?.name ?? prospect?.campaign?.name ?? contact.campaignName ?? undefined,
          status: ctx?.status ?? prospect?.status ?? contact.tofuStatus ?? undefined,
          score: num(ctx?.score ?? prospect?.score ?? contact.tofuScore),
          qualifiedReason: str(ctx?.qualifiedReason ?? prospect?.qualifiedReason ?? contact.tofuQualifiedReason),
          qualifiedAt: ctx?.qualifiedAt ?? prospect?.qualifiedAt ?? undefined,
          commCount: ctx
            ? arr(ctx.commLogs).length
            : num(prospect?.messageCount ?? contact.tofuCommCount),
          hasReply: prospect?.hasReply ?? undefined,
        }
      : undefined;

  const company = bu.company
    ? {
        id: bu.company.id ?? undefined,
        name: str(bu.company.name),
        domain: str(bu.company.domain),
        industry: str(bu.company.industry),
      }
    : contact.companyName
      ? { name: contact.companyName }
      : undefined;

  return {
    id: contact.id,
    businessUserId: bu.id ?? undefined,
    hubspotContactId: str(contact.hubspotContactId),
    name: contactDisplayName(bu, contact.email),
    firstName: str(bu.firstName),
    lastName: str(bu.lastName),
    email: str(bu.email) ?? str(contact.email),
    phone: str(bu.phone) ?? str(prospect?.phone),
    whatsapp: str(bu.whatsapp) ?? str(prospect?.whatsapp),
    linkedinUrl: str(bu.linkedinUrl) ?? str(prospect?.linkedinUrl),
    jobTitle: str(bu.jobTitle) ?? str(contact.title),
    department: str(bu.department),
    seniority: str(bu.seniority),
    location: str(bu.location),
    twitterId: str(bu.twitterId),
    persona: contact.persona ?? undefined,
    lifecycleStage: str(contact.lifecycleStage),
    ownerId: str(contact.ownerId),
    roleOnDeal: roleForContact(dealContacts, contact.id),
    company,
    companyName: company?.name ?? str(contact.companyName),
    tofu,
    recentComms,
  };
}

/** Reload contacts with full BusinessUser (+ company) and TOFU enrichment. */
async function enrichDealContactsForCockpit(prisma, tenantId, view, campaignContexts) {
  const contactIds = arr(view.dealContacts).map((dc) => dc.contactId).filter(Boolean);
  if (!contactIds.length) return [];

  const rows = await prisma.contact.findMany({
    where: { tenantId, id: { in: contactIds } },
    include: { businessUser: { include: { company: true } } },
  });

  const byId = new Map(rows.map((c) => [c.id, c]));
  const ordered = contactIds.map((id) => byId.get(id)).filter(Boolean);
  return enrichContactsWithCampaignContext(ordered, campaignContexts);
}

/** Load raw deal graph + related rows for Cockpit. Null if deal missing. */
export async function loadCockpitDealContext(prisma, tenantId, dealId) {
  const view = await getDealView(prisma, tenantId, dealId);
  if (!view?.deal) return null;

  const accountId = view.account?.id ?? null;
  const hubspotDealId = view.deal.hubspotDealId ?? null;
  const campaignContactIds = [
    ...new Set(
      [
        view.deal.campaignContactId,
        view.account?.campaignContactId,
        ...arr(view.dealContacts).map((dc) => dc.campaignContactId),
      ].filter(Boolean)
    ),
  ];

  const contactIds = arr(view.contacts).map((c) => c.id).filter(Boolean);

  const [companyInsight, accountSignals, recordings, tofuViews] = await Promise.all([
    accountId ? getLatestCompanyInsight(prisma, accountId) : null,
    accountId
      ? prisma.signal.findMany({
          where: { tenantId, accountId },
          orderBy: { score: "desc" },
          take: 12,
        })
      : [],
    prisma.dealRecording.findMany({
      where: { tenantId, dealId },
      orderBy: { occurredAt: "desc" },
      take: 6,
    }),
    Promise.all(
      campaignContactIds.slice(0, 8).map((ccId) => buildTofuProspectView(prisma, tenantId, ccId))
    ),
  ]);

  const campaignContexts =
    view.campaignContexts?.length
      ? view.campaignContexts
      : await loadCampaignContactContexts(prisma, tenantId, campaignContactIds);

  view.contacts = await enrichDealContactsForCockpit(prisma, tenantId, view, campaignContexts);
  view.campaignContexts = campaignContexts;

  return {
    view,
    vm: toDealViewModel(view),
    companyInsight,
    accountSignals,
    recordings,
    campaignContexts,
    tofuViews: tofuViews.filter(Boolean),
    scope: {
      dealId: view.deal.id,
      dealName: view.deal.name,
      accountId,
      companyName: view.company?.name ?? view.account?.company?.name ?? null,
      hubspotDealId,
      contactIds: arr(view.contacts).map((c) => c.id).filter(Boolean),
    },
  };
}

/** Compact loaded context into a bounded JSON snapshot for the model system prompt. */
export function compactCockpitDealContext(raw) {
  if (!raw?.view?.deal) return { kind: "empty" };

  const { view, vm, companyInsight, accountSignals, recordings, campaignContexts, tofuViews, scope } =
    raw;

  const profileOpts = { dealContacts: view.dealContacts, campaignContexts, tofuViews };
  const contacts = arr(view.contacts)
    .map((c) => buildContactProfile(c, profileOpts))
    .filter(Boolean);

  const gtmTasks = Object.values(vm.gtmTasks ?? {}).slice(0, 12).map((t) => ({
    stepKey: t.stepKey,
    subject: clamp(t.subject, 120),
    status: t.status ?? undefined,
    hubspotTaskId: t.hubspotTaskId ?? undefined,
  }));

  return {
    kind: "cockpit_deal",
    scope,
    deal: vm.deal
      ? {
          id: vm.deal.id,
          hubspotDealId: vm.deal.hubspotDealId ?? undefined,
          name: vm.deal.name,
          stage: vm.deal.stageLabel ?? undefined,
          stageBand: vm.deal.stageBand ?? undefined,
          amount: num(vm.deal.amount),
          score: num(vm.deal.score),
          status: vm.deal.status ?? undefined,
          lastActivityAt: vm.deal.lastActivityAt ?? undefined,
          closeDate: vm.deal.closeDate ?? undefined,
          description: clamp(vm.deal.description, 240),
        }
      : null,
    account: vm.account
      ? {
          id: vm.account.id,
          hubspotCompanyId: vm.account.hubspotCompanyId ?? undefined,
          lifecycleStage: vm.account.lifecycleStage ?? undefined,
        }
      : null,
    company: vm.company ?? undefined,
    intelligence: vm.hasInsight
      ? {
          computedAt: vm.insightComputedAt ?? undefined,
          accountScore: num(vm.accountScore),
          briefing: vm.briefing,
          insightDetected: vm.insightDetected,
          likelihoodToProgress: vm.likelihoodToProgress ?? undefined,
          followUpEffort: vm.followUpEffort ?? undefined,
          positiveOutcomes: arr(vm.positiveOutcomes).slice(0, 6),
          earlyWarnings: arr(vm.earlyWarnings).slice(0, 6),
          coachingTip: vm.coachingTip ?? undefined,
          recommendedActions: vm.recommendedActions,
          gtmPaths: arr(vm.gtmPaths).slice(0, 4).map((p) => ({
            title: p.title,
            scoreImpact: num(p.scoreImpact),
            steps: arr(p.steps).slice(0, 5),
            whyThisWorks: clamp(p.whyThisWorks, 200),
          })),
        }
      : { note: "No deal intelligence computed yet — run Recompute on the deal page." },
    contacts,
    signals: arr(view.signals).slice(0, 20).map(compactSignal),
    accountSignals: arr(accountSignals).slice(0, 10).map(compactSignal),
    nbas: arr(view.nbas).slice(0, 15).map(compactNba),
    gtmTasks,
    tofuCampaigns: arr(campaignContexts).map((ctx) => ({
      campaignContactId: ctx.id,
      campaignName: ctx.campaign?.name ?? undefined,
      status: ctx.status ?? undefined,
      score: num(ctx.score),
      contactName: ctx.contact?.businessUser?.name ?? undefined,
      contactId: ctx.contact?.id ?? undefined,
      commCount: arr(ctx.commLogs).length,
      lastComm: compactCommLog(arr(ctx.commLogs).at(-1)),
    })),
    companyIntelligence: companyInsight
      ? {
          computedAt: companyInsight.computedAt ?? undefined,
          ...compactCompanyInsightPayload(companyInsight.payload),
        }
      : null,
    recordings: arr(recordings).map((r) => ({
      id: r.id,
      type: r.engagementType ?? undefined,
      title: clamp(r.title, 120),
      occurredAt: r.occurredAt ?? undefined,
      hasTranscript: Boolean(r.transcriptAvailable && r.transcriptText?.trim()),
      transcriptExcerpt:
        r.transcriptAvailable && r.transcriptText ? clamp(r.transcriptText, TRANSCRIPT) : undefined,
    })),
  };
}

/** Load + compact in one call (used by chat agent and preload API). */
export async function buildCockpitDealSnapshot(prisma, tenantId, dealId) {
  const raw = await loadCockpitDealContext(prisma, tenantId, dealId);
  if (!raw) return { kind: "empty" };
  return compactCockpitDealContext(raw);
}

/** Expanded intelligence for tool fetch — same deal only. */
export function compactDealIntelligenceDetail(raw) {
  const vm = raw?.vm;
  if (!vm?.hasInsight) return { note: "No intelligence computed for this deal." };
  const payload = raw.view?.insight?.payload;
  return {
    ...compactCockpitDealContext(raw).intelligence,
    rawPayloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
    auraInsightDetected: payload?.aura_insight_detected ?? undefined,
    competitiveContext: clamp(payload?.competitive_context, PAYLOAD_FIELD),
    stakeholderMap: arr(payload?.stakeholder_map).slice(0, 8),
  };
}

/** Full comm thread for one contact on this deal (includes profile fields). */
export function compactContactConversations(raw, contactId) {
  const contact = arr(raw.view?.contacts).find((c) => c.id === contactId);
  if (!contact) return { error: "contact_not_on_deal" };

  const profile = buildContactProfile(contact, {
    dealContacts: raw.view?.dealContacts,
    campaignContexts: raw.campaignContexts,
    tofuViews: raw.tofuViews,
  });

  const ctx = arr(raw.campaignContexts).find((cc) => cc.contact?.id === contactId);
  const tofuView = arr(raw.tofuViews).find((tv) => tv.prospect?.contactId === contactId);

  const conversations = ctx
    ? arr(ctx.commLogs).map(compactCommLog).filter(Boolean)
    : arr(tofuView?.prospect?.communications).map(compactCommFromProspect).filter(Boolean);

  return {
    ...profile,
    conversations,
    campaign: ctx?.campaign?.name ?? tofuView?.campaign?.name ?? undefined,
  };
}

/** Full contact detail — same graph as /api/assist/contact/[id]/view. */
export async function loadContactDetailForCockpit(prisma, tenantId, dealId, contactId) {
  const view = await getContactView(prisma, tenantId, contactId, { dealId });
  if (!view) return { error: "contact_not_found" };

  const bu = view.businessUser ?? view.contact?.businessUser ?? {};
  const prospect = view.tofuProspectView?.prospect;

  const profile = {
    id: view.contact?.id,
    businessUserId: bu.id ?? undefined,
    hubspotContactId: str(view.contact?.hubspotContactId),
    name: contactDisplayName(bu),
    firstName: str(bu.firstName),
    lastName: str(bu.lastName),
    email: str(bu.email),
    phone: str(bu.phone) ?? str(prospect?.phone),
    whatsapp: str(bu.whatsapp) ?? str(prospect?.whatsapp),
    linkedinUrl: str(bu.linkedinUrl) ?? str(prospect?.linkedinUrl),
    jobTitle: str(bu.jobTitle),
    department: str(bu.department),
    seniority: str(bu.seniority),
    location: str(bu.location),
    persona: view.contact?.persona ?? undefined,
    lifecycleStage: str(view.contact?.lifecycleStage),
    roleOnDeal: str(view.dealContact?.role),
    company: view.company
      ? {
          id: view.company.id ?? undefined,
          name: str(view.company.name),
          domain: str(view.company.domain),
          industry: str(view.company.industry),
        }
      : undefined,
  };

  const tofuCampaigns = arr(view.tofuProspectViews).map((tv) => ({
    campaignContactId: tv.campaignContactId,
    campaignName: tv.campaign?.name ?? undefined,
    status: tv.prospect?.status ?? undefined,
    statusLabel: tv.prospect?.statusLabel ?? undefined,
    score: num(tv.prospect?.score),
    phone: str(tv.prospect?.phone),
    whatsapp: str(tv.prospect?.whatsapp),
    email: str(tv.prospect?.email),
    messageCount: num(tv.prospect?.messageCount),
    hasReply: tv.prospect?.hasReply ?? undefined,
    communications: arr(tv.prospect?.communications).map(compactCommFromProspect).filter(Boolean),
  }));

  return {
    profile,
    dealContact: view.dealContact
      ? {
          role: str(view.dealContact.role),
          campaignName: view.dealContact.campaignContact?.campaign?.name ?? undefined,
        }
      : null,
    companyInsight: view.insight
      ? {
          computedAt: view.insight.computedAt ?? undefined,
          ...compactCompanyInsightPayload(view.insight.payload),
        }
      : null,
    signals: arr(view.signals).slice(0, 10).map(compactSignal),
    nbas: arr(view.nbas).slice(0, 10).map(compactNba),
    tofuCampaigns,
    primaryTofu: view.tofuProspectView
      ? {
          campaignName: view.tofuProspectView.campaign?.name ?? undefined,
          communications: arr(view.tofuProspectView.prospect?.communications)
            .map(compactCommFromProspect)
            .filter(Boolean),
        }
      : null,
  };
}

/** Company intelligence detail for this deal's account. */
export function compactCompanyIntelligenceDetail(raw) {
  const insight = raw?.companyInsight;
  if (!insight) return { note: "No company intelligence for this account." };
  const payload = insight.payload;
  return {
    computedAt: insight.computedAt ?? undefined,
    summary: compactCompanyInsightPayload(payload),
    payloadExcerpt:
      payload && typeof payload === "object"
        ? JSON.stringify(payload).slice(0, 4000) +
          (JSON.stringify(payload).length > 4000 ? "…" : "")
        : undefined,
  };
}

/** Recording transcripts for this deal. */
export function compactDealRecordingsDetail(raw) {
  return {
    recordings: arr(raw.recordings).map((r) => ({
      id: r.id,
      type: r.engagementType ?? undefined,
      title: clamp(r.title, 120),
      occurredAt: r.occurredAt ?? undefined,
      transcript:
        r.transcriptAvailable && r.transcriptText ? clamp(r.transcriptText, 6000) : undefined,
    })),
  };
}

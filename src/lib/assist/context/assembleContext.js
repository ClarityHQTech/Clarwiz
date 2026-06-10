/**
 * Context assembly for the AURA intelligence prompts. Reads the hydrated graph
 * via the insightsReader view-models and shapes the `vars` object the prompt
 * templates expect: { ontology, engagements, companyData, contactData, dealData,
 * tenantData, ownerData, signals, previousInsights }.
 *
 * Everything here is null-safe and best-effort — a missing tenant row or a
 * CommunicationLog read failure must degrade gracefully, never throw, so a
 * recompute always has *something* to send to the model.
 */
import { getDealView, getCompanyView } from "@/lib/assist/insightsReader";
import { ONTOLOGY } from "@/lib/assist/prompts/ontology.js";
import { fetchDealEngagements } from "@/lib/assist/hubspotRead.js";

const ENGAGEMENT_TAKE = 30;
const HS_ENGAGEMENT_CAP = 25;

/** Best-effort tenant row (for tenantData / ownerData). Null on any failure. */
async function safeTenant(prisma, tenantId) {
  try {
    return await prisma.tenant.findUnique({ where: { id: tenantId } });
  } catch {
    return null;
  }
}

/**
 * Best-effort recent engagements. CommunicationLog is campaign-scoped (not
 * directly deal-linked), so we pull the tenant's most recent comms, optionally
 * narrowed to the contacts on this deal/account. Always returns an array.
 */
async function safeEngagements(prisma, tenantId, contactIds = []) {
  try {
    const where = { tenantId };
    if (contactIds.length) {
      where.campaignContact = { is: { contactId: { in: contactIds } } };
    }
    const rows = await prisma.communicationLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: ENGAGEMENT_TAKE,
    });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Derive owner data from the tenant's team mapping + the deal/account ownerId. */
function deriveOwnerData(tenant, ownerId) {
  if (!ownerId && !tenant) return null;
  return {
    ownerId: ownerId ?? null,
    team: tenant?.company_details ?? null,
  };
}

/**
 * Best-effort HubSpot engagements for one deal. Empty array on no token / no
 * hubspotDealId / any failure (fetchDealEngagements never throws).
 */
async function safeHubspotEngagements(token, hubspotDealId, fetchImpl) {
  if (!token || !hubspotDealId) return [];
  try {
    return await fetchDealEngagements(token, hubspotDealId, fetchImpl ? { fetchImpl } : {});
  } catch {
    return [];
  }
}

/** Stored call/meeting transcripts from the last HubSpot recording sync. */
async function safeDealRecordingEngagements(prisma, dealId) {
  if (!dealId) return [];
  try {
    const rows = await prisma.dealRecording.findMany({
      where: { dealId, transcriptAvailable: true },
      orderBy: { occurredAt: "desc" },
      take: 15,
    });
    return rows
      .filter((r) => r.transcriptText?.trim())
      .map((r) => {
        const iso = r.occurredAt?.toISOString?.() ?? null;
        return {
          type: r.engagementType,
          channel: r.engagementType,
          subject: r.title,
          text: r.transcriptText,
          content: r.transcriptText,
          message: r.transcriptText,
          at: r.occurredAt ? r.occurredAt.getTime() : null,
          sentAt: iso,
          createdAt: iso,
          source: "hubspot_recording",
          transcriptSource: r.transcriptSource,
        };
      });
  } catch {
    return [];
  }
}

/** Resolve a HubSpot object id from a deal/account payload, best-effort. */
function hsObjectIdOf(entity) {
  const p = entity?.payload ?? {};
  return p.hs_object_id ?? p.hsObjectId ?? entity?.hubspotDealId ?? entity?.hubspotCompanyId ?? null;
}

/**
 * Assemble prompt vars for a single deal. Returns null if the deal is gone.
 *
 * When a HubSpot `token` is supplied (4th arg), the deal's actual HubSpot
 * engagements (emails/meetings/notes/calls) are fetched and merged AHEAD of the
 * campaign-scoped communicationLog rows — without a token the behavior is
 * unchanged. NOTE: HubSpot auto-associated emails may surface low-value signals;
 * association hygiene is handled separately.
 */
export async function assembleDealContext(prisma, tenantId, dealId, { token, fetchImpl } = {}) {
  const view = await getDealView(prisma, tenantId, dealId);
  if (!view) return null;

  const contacts = view.contacts ?? [];
  const contactIds = contacts.map((c) => c?.id).filter(Boolean);
  const hubspotDealId = view.deal?.hubspotDealId ?? null;

  const [tenant, commLogs, hsEngagements, recordingEngagements] = await Promise.all([
    safeTenant(prisma, tenantId),
    safeEngagements(prisma, tenantId, contactIds),
    safeHubspotEngagements(token, hubspotDealId, fetchImpl),
    safeDealRecordingEngagements(prisma, dealId),
  ]);

  // Stored transcripts (post-sync) take priority over live HubSpot engagement snippets.
  const engagements = [...recordingEngagements, ...hsEngagements, ...commLogs];

  const ownerId = view.deal?.ownerId ?? view.account?.ownerId ?? null;

  return {
    ontology: ONTOLOGY,
    engagements,
    companyData: view.company ?? view.account ?? null,
    contactData: contacts,
    dealData: view.deal ?? null,
    tenantData: tenant,
    ownerData: deriveOwnerData(tenant, ownerId),
    signals: view.signals ?? [],
    previousInsights: view.insight?.payload ?? null,
    // internal handles for the orchestrator (underscore-prefixed; not template keys)
    _dealId: view.deal?.id ?? dealId,
    _accountId: view.account?.id ?? null,
    _hsObjectId: hsObjectIdOf(view.deal),
  };
}

/**
 * Assemble prompt vars for a company/account briefing. Null if account gone.
 *
 * When a HubSpot `token` is supplied, HubSpot engagements are aggregated across
 * the account's deals (capped) and merged ahead of communicationLog rows.
 */
export async function assembleCompanyContext(prisma, tenantId, accountId, { token, fetchImpl } = {}) {
  const view = await getCompanyView(prisma, tenantId, accountId);
  if (!view) return null;

  const contacts = view.contacts ?? [];
  const contactIds = contacts.map((c) => c?.id).filter(Boolean);
  const hubspotDealIds = (view.deals ?? [])
    .map((d) => d?.hubspotDealId)
    .filter(Boolean);

  const [tenant, commLogs, hsLists] = await Promise.all([
    safeTenant(prisma, tenantId),
    safeEngagements(prisma, tenantId, contactIds),
    Promise.all(hubspotDealIds.map((id) => safeHubspotEngagements(token, id, fetchImpl))),
  ]);

  const hsEngagements = hsLists
    .flat()
    .sort((a, b) => (b?.at ?? 0) - (a?.at ?? 0))
    .slice(0, HS_ENGAGEMENT_CAP);

  const engagements = [...hsEngagements, ...commLogs];

  const ownerId = view.account?.ownerId ?? null;

  return {
    ontology: ONTOLOGY,
    engagements,
    companyData: view.company ?? view.account ?? null,
    contactData: contacts,
    dealData: view.deals ?? [],
    tenantData: tenant,
    ownerData: deriveOwnerData(tenant, ownerId),
    signals: view.signals ?? [],
    previousInsights: view.insight?.payload ?? null,
    _accountId: view.account?.id ?? accountId,
    _hsObjectId: hsObjectIdOf(view.account),
  };
}

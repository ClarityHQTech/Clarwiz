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

const ENGAGEMENT_TAKE = 30;

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
      where.contactCampaign = { is: { contactId: { in: contactIds } } };
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

/** Resolve a HubSpot object id from a deal/account payload, best-effort. */
function hsObjectIdOf(entity) {
  const p = entity?.payload ?? {};
  return p.hs_object_id ?? p.hsObjectId ?? entity?.hubspotDealId ?? entity?.hubspotCompanyId ?? null;
}

/** Assemble prompt vars for a single deal. Returns null if the deal is gone. */
export async function assembleDealContext(prisma, tenantId, dealId) {
  const view = await getDealView(prisma, tenantId, dealId);
  if (!view) return null;

  const contacts = view.contacts ?? [];
  const contactIds = contacts.map((c) => c?.id).filter(Boolean);

  const [tenant, engagements] = await Promise.all([
    safeTenant(prisma, tenantId),
    safeEngagements(prisma, tenantId, contactIds),
  ]);

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

/** Assemble prompt vars for a company/account briefing. Null if account gone. */
export async function assembleCompanyContext(prisma, tenantId, accountId) {
  const view = await getCompanyView(prisma, tenantId, accountId);
  if (!view) return null;

  const contacts = view.contacts ?? [];
  const contactIds = contacts.map((c) => c?.id).filter(Boolean);

  const [tenant, engagements] = await Promise.all([
    safeTenant(prisma, tenantId),
    safeEngagements(prisma, tenantId, contactIds),
  ]);

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

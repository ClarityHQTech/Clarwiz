import { prisma as defaultPrisma } from "@/lib/prisma";
import { getSorAdapter } from "@/lib/sor/SorAdapter";
import { notifyTeam as defaultNotify } from "@/lib/mofu/notify";

/**
 * US-12.1 — Transition: prospect -> opportunity. Creates Company + Contact + Deal
 * in HubSpot and the Clarwiz Deal pointer, then notifies the team. Idempotent:
 * dedupe company by domain, contact by email, deal by existing hubspot_deal_id;
 * never a second Deal for the same (contact, campaign). Notification failure never
 * blocks the HubSpot writes.
 */
export async function transitionToOpportunity(
  {
    tenantId,
    source = "MANUAL",
    contactCampaignId = null,
    clarwizContactId = null,
    company = {},
    contact = {},
    dealName = null,
    stage = null,
    amount = null,
    deepLink = null,
  },
  deps = {}
) {
  const prisma = deps.prisma ?? defaultPrisma;
  const adapter = deps.adapter ?? getSorAdapter();
  const notifyTeam = deps.notifyTeam ?? defaultNotify;

  // Idempotency by origin contactCampaign: never a second Deal for the same prospect.
  if (contactCampaignId) {
    const existing = await prisma.deal.findFirst({ where: { tenantId, originContactCampaignId: contactCampaignId } });
    if (existing) {
      return { ok: true, idempotent: true, dealId: existing.id, hubspotDealId: existing.hubspotDealId };
    }
  }

  const externalRef = {};

  const companyRes = await adapter.upsertCompany(tenantId, { name: company.name, domain: company.domain }, deps.adapterDeps);
  if (!companyRes.ok) return { ok: false, reason: companyRes.reason, externalRef };
  externalRef.companyId = companyRes.id;

  const contactRes = await adapter.upsertContact(
    tenantId,
    { email: contact.email, firstName: contact.firstName, lastName: contact.lastName, companyId: companyRes.id },
    deps.adapterDeps
  );
  if (!contactRes.ok) return { ok: false, reason: contactRes.reason, externalRef };
  externalRef.contactId = contactRes.id;

  const dealRes = await adapter.createDeal(
    tenantId,
    { name: dealName ?? company.name ?? "New opportunity", companyId: companyRes.id, contactId: contactRes.id, stage, amount },
    deps.adapterDeps
  );
  if (!dealRes.ok) return { ok: false, reason: dealRes.reason, externalRef };
  externalRef.dealId = dealRes.id;

  // Clarwiz Deal pointer — dedupe by hubspot_deal_id.
  const deal = await prisma.deal.upsert({
    where: { tenantId_hubspotDealId: { tenantId, hubspotDealId: dealRes.id } },
    create: {
      tenantId,
      hubspotDealId: dealRes.id,
      name: dealName ?? company.name ?? null,
      source,
      originContactCampaignId: contactCampaignId,
      cachedAmount: amount ?? undefined,
      cachedStage: stage ?? undefined,
    },
    update: {},
  });

  // Handoff markers on the Clarwiz Contact (if provided).
  if (clarwizContactId) {
    await prisma.contact
      .update({ where: { id: clarwizContactId }, data: { mqlAt: new Date(), promotedDealId: deal.id } })
      .catch(() => {});
  }

  // Notify the team — best-effort, never blocks.
  let notified = false;
  try {
    const n = await notifyTeam({ message: `New opportunity: ${dealName ?? company.name ?? "Deal"}`, deepLink }, deps.notifyDeps);
    notified = !!n.ok;
  } catch {
    notified = false;
  }

  return { ok: true, dealId: deal.id, hubspotDealId: dealRes.id, externalRef, notified };
}

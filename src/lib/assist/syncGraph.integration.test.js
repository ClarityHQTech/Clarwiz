import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { syncCrmGraph } from "./syncGraph.js";

// DB integration test against the local clarwiz_v2 dev DB. Skips cleanly when no DB.
const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

// ── Fixture HubSpot portal ────────────────────────────────────────────────
const PIPELINES = {
  results: [
    {
      label: "Sales Pipeline",
      stages: [
        { id: "s0", label: "Prospecting", displayOrder: 0, metadata: { isClosed: "false" } },
        { id: "s1", label: "Qualified Lead", displayOrder: 1, metadata: { isClosed: "false" } },
        { id: "s2", label: "Proposal Sent", displayOrder: 2, metadata: { isClosed: "false" } },
        { id: "s3", label: "Negotiation", displayOrder: 3, metadata: { isClosed: "false" } },
        { id: "closedwon", label: "Closed Won", displayOrder: 4, metadata: { isClosed: "true", probability: "1.0" } },
      ],
    },
  ],
};
const DEAL = {
  id: "D-INT-1",
  properties: { dealname: "Acme — Platform", amount: "50000", dealstage: "s2", hubspot_owner_id: "OW1", hs_lastmodifieddate: "2026-06-07T00:00:00Z" },
};
const COMPANY = { id: "CO-INT-1", properties: { name: "Acme IntegrationTest Co", domain: "acme-int.test", industry: "TECH" } };
const CONTACT = { id: "CT-INT-1", properties: { email: "Buyer@acme-int.test", firstname: "Bea", lastname: "Buyer", jobtitle: "VP", lifecyclestage: "lead", hubspot_owner_id: "OW1" } };
const MQL = { id: "CT-INT-2", properties: { email: "lead@acme-int.test", firstname: "Lee", lastname: "Lead", lifecyclestage: "marketingqualifiedlead" } };

// Routes fixture responses by URL + method.
function fixtureFetch(url, opts = {}) {
  const u = String(url);
  const json = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
  if (u.includes("/pipelines/deals")) return json(PIPELINES);
  if (u.includes("/objects/deals/search")) return json({ results: [DEAL], paging: null });
  if (u.includes("/objects/contacts/search")) return json({ results: [MQL], paging: null });
  if (u.includes(`/objects/deals/${DEAL.id}?associations`))
    return json({ associations: { companies: { results: [{ id: COMPANY.id }, { id: COMPANY.id }] }, contacts: { results: [{ id: CONTACT.id }] } } });
  if (u.includes("/objects/companies/batch/read")) return json({ results: [COMPANY] });
  if (u.includes("/objects/contacts/batch/read")) return json({ results: [CONTACT] });
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
}

d("syncCrmGraph (DB integration)", () => {
  const prisma = new PrismaClient();
  let tenantId;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: "INT-TEST-TENANT" } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // Cascade-clean tenant-scoped rows, then the global rows this test created.
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.businessUser.deleteMany({ where: { email: { endsWith: "@acme-int.test" } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { name: "Acme IntegrationTest Co" } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("hydrates Account, Deal, Contact, DealContact and a separate MQL lead", async () => {
    const res = await syncCrmGraph(prisma, tenantId, "fake-token", { fetchImpl: fixtureFetch });
    expect(res.ok).toBe(true);
    expect(res.counts.deals).toBe(1);
    expect(res.counts.accounts).toBe(1); // dedup of the repeated company id
    expect(res.counts.contacts).toBe(1);
    expect(res.counts.leads).toBe(1);

    const deal = await prisma.deal.findUnique({
      where: { tenantId_hubspotDealId: { tenantId, hubspotDealId: "D-INT-1" } },
      include: { account: { include: { company: true } }, dealContacts: { include: { contact: { include: { businessUser: true } } } } },
    });
    expect(deal.name).toBe("Acme — Platform");
    expect(deal.amount).toBe(50000);
    expect(deal.stageBand).toBe("DEAL_LATE");
    expect(deal.status).toBe("OPEN");
    expect(deal.account.hubspotCompanyId).toBe("CO-INT-1");
    expect(deal.account.company.name).toBe("Acme IntegrationTest Co");
    expect(deal.dealContacts).toHaveLength(1);
    expect(deal.dealContacts[0].contact.businessUser.email).toBe("buyer@acme-int.test");
    expect(deal.dealContacts[0].contact.hubspotContactId).toBe("CT-INT-1");
  });

  it("is idempotent — a second sync produces no duplicates", async () => {
    await syncCrmGraph(prisma, tenantId, "fake-token", { fetchImpl: fixtureFetch });
    const deals = await prisma.deal.count({ where: { tenantId } });
    const accounts = await prisma.account.count({ where: { tenantId } });
    expect(deals).toBe(1);
    expect(accounts).toBe(1);
  });
});

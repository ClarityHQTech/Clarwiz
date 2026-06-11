import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pushQualifiedToHubspot,
  syncQualifiedCampaignToCrm,
} from "./pushQualifiedToHubspot.js";

const CC_ID = "cc-1";
const TENANT_ID = "tenant-1";
const CAMPAIGN_ID = "camp-1";

function makeCc(overrides = {}) {
  return {
    id: CC_ID,
    status: "QUALIFIED",
    hubspotDealId: null,
    qualifiedAt: new Date("2026-06-10"),
    qualifiedReason: "positive_reply",
    score: 95,
    contactId: "contact-1",
    campaign: { id: CAMPAIGN_ID, name: "Summer 2025", tenantId: TENANT_ID },
    contact: {
      id: "contact-1",
      hubspotContactId: null,
      ownerId: null,
      businessUser: {
        name: "Jane Buyer",
        firstName: "Jane",
        lastName: "Buyer",
        email: "jane@acme.test",
        jobTitle: "VP Sales",
        phone: "+15551234",
        whatsapp: null,
        linkedinUrl: null,
        company: {
          name: "Acme Corp",
          domain: "acme.test",
          industry: "Software",
        },
      },
    },
    commLogs: [
      {
        channel: "email",
        message: "Hello",
        status: "sent",
        sentAt: new Date("2026-06-09"),
        responseContent: "Sounds good",
      },
    ],
    ...overrides,
  };
}

function makePrisma(cc) {
  return {
    campaignContact: {
      findUnique: vi.fn().mockResolvedValue(cc),
      findMany: vi.fn().mockResolvedValue([{ id: CC_ID }]),
      update: vi.fn().mockResolvedValue({}),
    },
    contact: { update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((ops) => Promise.all(ops)),
    mofuIntegration: { findUnique: vi.fn() },
  };
}

vi.mock("@/lib/assist/mofuIntegration", () => ({
  getDecryptedHubspotToken: vi.fn().mockResolvedValue("hs-tok"),
  getMofuIntegration: vi.fn().mockResolvedValue({ defaultOwnerId: null }),
}));

vi.mock("@/lib/assist/hubspot", () => ({
  getDealPipelines: vi.fn().mockResolvedValue({
    results: [{ stages: [{ id: "s1", displayOrder: 0, metadata: { isClosed: "false" } }] }],
  }),
}));

vi.mock("@/lib/crm/campaignContactBridge", () => ({
  CLARWIZ_CAMPAIGN_CONTACT_ID_PROP: "clarwiz_campaign_contact_id",
  getClarwizCampaignContactStampableMap: vi.fn().mockResolvedValue({
    deals: true,
    contacts: true,
    companies: true,
  }),
}));

vi.mock("@/lib/assist/hubspotWrite", () => ({
  searchContactByEmail: vi.fn().mockResolvedValue(null),
  createContact: vi.fn().mockResolvedValue({ ok: true, id: "HS-CT-1" }),
  searchCompanyByDomain: vi.fn().mockResolvedValue(null),
  createCompany: vi.fn().mockResolvedValue({ ok: true, id: "HS-CO-1" }),
  createDeal: vi.fn().mockResolvedValue({ ok: true, id: "HS-DEAL-1" }),
  patchCrmObject: vi.fn().mockResolvedValue({ ok: true }),
  associate: vi.fn().mockResolvedValue({ ok: true }),
  associateContactToCompany: vi.fn().mockResolvedValue({ ok: true }),
  addNote: vi.fn().mockResolvedValue({ ok: true, id: "HS-NOTE-1" }),
}));

describe("pushQualifiedToHubspot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when already synced", async () => {
    const prisma = makePrisma(makeCc({ hubspotDealId: "existing-deal" }));
    const res = await pushQualifiedToHubspot(prisma, CC_ID);
    expect(res.skipped).toBe(true);
    expect(res.hubspotDealId).toBe("existing-deal");
  });

  it("creates contact, company, deal and marks campaign contact synced", async () => {
    const prisma = makePrisma(makeCc());
    const { createDeal, createContact, createCompany } = await import(
      "@/lib/assist/hubspotWrite"
    );

    const res = await pushQualifiedToHubspot(prisma, CC_ID);

    expect(res.ok).toBe(true);
    expect(res.hubspotDealId).toBe("HS-DEAL-1");
    expect(createContact).toHaveBeenCalled();
    expect(createCompany).toHaveBeenCalled();
    expect(createDeal).toHaveBeenCalledWith(
      "hs-tok",
      expect.objectContaining({ campaignContactId: CC_ID }),
      expect.any(Object)
    );
    expect(prisma.campaignContact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hubspotDealId: "HS-DEAL-1" }),
      })
    );
    expect(prisma.contact.update).toHaveBeenCalled();
  });

  it("batch sync processes unsynced qualified rows", async () => {
    const prisma = makePrisma(makeCc());
    prisma.campaignContact.findUnique = vi.fn().mockResolvedValue(makeCc());

    const res = await syncQualifiedCampaignToCrm(prisma, CAMPAIGN_ID);
    expect(res.total).toBe(1);
    expect(res.synced).toBe(1);
  });
});

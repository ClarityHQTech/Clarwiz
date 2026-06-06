import { describe, it, expect, vi } from "vitest";
import { transitionToOpportunity } from "@/lib/mofu/transition";

function adapterOk() {
  return {
    upsertCompany: vi.fn(async () => ({ ok: true, id: "comp_1" })),
    upsertContact: vi.fn(async () => ({ ok: true, id: "cont_1" })),
    createDeal: vi.fn(async () => ({ ok: true, id: "hsdeal_1" })),
  };
}

describe("transitionToOpportunity (US-12.1)", () => {
  it("creates company+contact+deal + pointer + notifies", async () => {
    const prisma = {
      deal: { findFirst: vi.fn(async () => null), upsert: vi.fn(async (a) => ({ id: "deal_1", ...a.create })) },
      contact: { update: vi.fn(async () => ({})) },
    };
    const notifyTeam = vi.fn(async () => ({ ok: true }));
    const out = await transitionToOpportunity(
      { tenantId: "t1", source: "MANUAL", company: { name: "Acme", domain: "acme.com" }, contact: { email: "a@acme.com" }, dealName: "Acme Deal" },
      { prisma, adapter: adapterOk(), notifyTeam }
    );
    expect(out.ok).toBe(true);
    expect(out.hubspotDealId).toBe("hsdeal_1");
    expect(out.externalRef).toMatchObject({ companyId: "comp_1", contactId: "cont_1", dealId: "hsdeal_1" });
    expect(out.notified).toBe(true);
  });

  it("idempotent: existing Deal for the contactCampaign returns it, no new HubSpot writes", async () => {
    const adapter = adapterOk();
    const prisma = {
      deal: { findFirst: vi.fn(async () => ({ id: "deal_x", hubspotDealId: "hsdeal_x" })), upsert: vi.fn() },
    };
    const out = await transitionToOpportunity(
      { tenantId: "t1", contactCampaignId: "cc1", company: { name: "Acme" }, contact: { email: "a@acme.com" } },
      { prisma, adapter, notifyTeam: vi.fn(async () => ({ ok: true })) }
    );
    expect(out).toMatchObject({ ok: true, idempotent: true, dealId: "deal_x" });
    expect(adapter.createDeal).not.toHaveBeenCalled();
  });

  it("partial failure mid-way returns the partial externalRef", async () => {
    const adapter = adapterOk();
    adapter.createDeal = vi.fn(async () => ({ ok: false, reason: "hubspot_unauthorized" }));
    const prisma = { deal: { findFirst: vi.fn(async () => null), upsert: vi.fn() } };
    const out = await transitionToOpportunity(
      { tenantId: "t1", company: { name: "Acme" }, contact: { email: "a@acme.com" } },
      { prisma, adapter, notifyTeam: vi.fn() }
    );
    expect(out.ok).toBe(false);
    expect(out.externalRef).toMatchObject({ companyId: "comp_1", contactId: "cont_1" });
    expect(out.externalRef.dealId).toBeUndefined();
  });

  it("notification failure does not block the HubSpot writes", async () => {
    const prisma = { deal: { findFirst: vi.fn(async () => null), upsert: vi.fn(async (a) => ({ id: "deal_1", ...a.create })) }, contact: { update: vi.fn() } };
    const notifyTeam = vi.fn(async () => { throw new Error("slack_down"); });
    const out = await transitionToOpportunity(
      { tenantId: "t1", company: { name: "Acme" }, contact: { email: "a@acme.com" } },
      { prisma, adapter: adapterOk(), notifyTeam }
    );
    expect(out.ok).toBe(true);
    expect(out.notified).toBe(false);
  });
});

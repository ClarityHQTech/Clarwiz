import { describe, it, expect, vi } from "vitest";
import { personaFromTitle, getTenantCompanies, getTenantContacts } from "@/lib/mofu/directory";

describe("directory (companies/contacts)", () => {
  it("infers persona from title", () => {
    expect(personaFromTitle("Executive Chairperson")).toBe("DECISION_MAKER");
    expect(personaFromTitle("VP of Sales")).toBe("DECISION_MAKER");
    expect(personaFromTitle("Senior Engineer")).toBe("INFLUENCER");
    expect(personaFromTitle("")).toBe("OTHER");
  });

  it("aggregates distinct companies across deals", async () => {
    const prisma = {
      deal: {
        findMany: vi.fn(async () => [
          { name: "Acme Deal", hubspotDealId: "d1", context: { data: { cached: { company: { id: "c1", name: "Acme", domain: "acme.com" } } } } },
          { name: "Acme Deal 2", hubspotDealId: "d2", context: { data: { cached: { company: { id: "c1", name: "Acme", domain: "acme.com" } } } } },
        ]),
      },
      dealInsight: { findFirst: vi.fn(async () => null) },
    };
    const out = await getTenantCompanies({ tenantId: "t1" }, { prisma });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "c1", dealCount: 2 });
  });

  it("aggregates contacts with personas across deals", async () => {
    const prisma = {
      deal: {
        findMany: vi.fn(async () => [
          { name: "Acme Deal", hubspotDealId: "d1", context: { data: { cached: { contacts: [{ id: "ct1", name: "Brian", title: "Executive Chairperson", email: "b@x.com" }] } } } },
        ]),
      },
    };
    const out = await getTenantContacts({ tenantId: "t1" }, { prisma });
    expect(out[0]).toMatchObject({ id: "ct1", persona: "DECISION_MAKER" });
    expect(out[0].deals[0].name).toBe("Acme Deal");
  });
});

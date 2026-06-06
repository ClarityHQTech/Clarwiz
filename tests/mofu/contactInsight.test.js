import { describe, it, expect, vi } from "vitest";
import { getContactInsight } from "@/lib/mofu/insightsReader";

describe("getContactInsight (contact level)", () => {
  it("derives the contact view from the deal bundle + contact signals", async () => {
    const prisma = {
      deal: {
        findFirst: vi.fn(async () => ({
          id: "deal_1",
          context: { data: { cached: { contacts: [{ id: "c1", name: "Dana Cole", title: "VP Engineering", email: "d@acme.com", phone: "+1" }] } } },
        })),
      },
      dealInsight: {
        findFirst: vi.fn(async () => ({
          stakeholderIntelligence: { individual_profiles: [{ name: "Dana Cole", role_type: "champion", influence_level: "high", engagement_status: "active", engagement_strategy: "Loop in the EB." }] },
        })),
      },
      dealSignal: {
        findMany: vi.fn(async () => [{ id: "s1", kind: "EMAIL", summary: "pricing reply", score: 0.9, occurredAt: new Date() }]),
      },
    };
    const out = await getContactInsight({ tenantId: "t1", dealId: "deal_1", contactId: "c1" }, { prisma });
    expect(out.ok).toBe(true);
    expect(out.contact).toMatchObject({ name: "Dana Cole", persona: "DECISION_MAKER", role_type: "champion", recommended_approach: "Loop in the EB." });
    expect(out.signals).toHaveLength(1);
  });

  it("returns contact_not_found when the contact isn't associated", async () => {
    const prisma = {
      deal: { findFirst: vi.fn(async () => ({ id: "deal_1", context: { data: { cached: { contacts: [] } } } })) },
    };
    const out = await getContactInsight({ tenantId: "t1", dealId: "deal_1", contactId: "x" }, { prisma });
    expect(out).toMatchObject({ ok: false, reason: "contact_not_found" });
  });
});

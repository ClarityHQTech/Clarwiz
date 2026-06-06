import { describe, it, expect } from "vitest";
import { buildOntology } from "@/lib/mofu/contextOntology";

describe("buildOntology (Aura-grade context)", () => {
  it("assembles company + per-contact engagements/signals + timeline", () => {
    const o = buildOntology({
      deal: { name: "Acme — Platform", stage: "qualifiedtobuy", amount: 84000, currency: "USD" },
      company: { name: "Acme", domain: "acme.com", industry: "Logistics", employees: "1400", revenue: "5000000" },
      contacts: [{ id: "c1", name: "Dana Cole", title: "VP Engineering", email: "d@acme.com" }],
      engagements: [
        { kind: "CALL_TRANSCRIPT", summary: "discovery", occurredAt: "2026-06-01T00:00:00Z", contactId: "c1" },
        { kind: "EMAIL", summary: "reply", occurredAt: "2026-06-03T00:00:00Z", contactId: "c1" },
      ],
      signals: [{ signalReferenceId: "s1", kind: "EMAIL", summary: "pricing", score: 0.9, contactId: "c1" }],
    });
    expect(o.company.industry).toBe("Logistics");
    expect(o.deal.name).toBe("Acme — Platform");
    const c = o.contacts[0];
    expect(c.persona).toBe("DECISION_MAKER"); // VP -> decision maker
    expect(c.engagement_count).toBe(2);
    expect(c.signals).toHaveLength(1);
    expect(c.last_touch).toBe("2026-06-03T00:00:00Z");
    expect(o.engagement_timeline.map((e) => e.kind)).toEqual(["CALL_TRANSCRIPT", "EMAIL"]); // sorted asc
  });

  it("tolerates missing company/contacts", () => {
    const o = buildOntology({ signals: [] });
    expect(o.company).toBeNull();
    expect(o.contacts).toEqual([]);
  });
});

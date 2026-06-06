import { describe, it, expect, vi } from "vitest";
import { draftRecommendation, approveRecommendation, executeRecommendation } from "@/lib/mofu/execution/rails";

function recStore(initial) {
  const state = { ...initial };
  return {
    state,
    prisma: {
      nbaRecommendation: {
        findFirst: vi.fn(async () => ({ ...state, deal: { hubspotDealId: "d1", name: "Acme" } })),
        update: vi.fn(async ({ data }) => {
          Object.assign(state, data);
          return { ...state };
        }),
      },
    },
  };
}

describe("execution rails (US-6.1)", () => {
  it("draft sets DRAFTED with a generated draft", async () => {
    const s = recStore({ id: "r1", tenantId: "t1", actionType: "SEND_EMAIL", title: "Follow up", status: "SUGGESTED", payload: { rationale: "pricing" } });
    const out = await draftRecommendation({ tenantId: "t1", recId: "r1" }, { prisma: s.prisma });
    expect(out.ok).toBe(true);
    expect(s.state.status).toBe("DRAFTED");
    expect(out.draft.body).toBe("pricing");
  });

  it("blocks outbound execution without approval (403)", async () => {
    const s = recStore({ id: "r1", tenantId: "t1", actionType: "SEND_EMAIL", title: "x", status: "DRAFTED", payload: { draft: { subject: "s", body: "b" } } });
    const out = await executeRecommendation({ tenantId: "t1", recId: "r1" }, { prisma: s.prisma, runExecutor: vi.fn() });
    expect(out).toMatchObject({ ok: false, reason: "approval_required", status: 403 });
  });

  it("approved outbound executes, sets SENT + engagement id", async () => {
    const s = recStore({ id: "r1", tenantId: "t1", actionType: "SEND_EMAIL", title: "x", status: "APPROVED", payload: { draft: { subject: "s", body: "b" } } });
    const runExecutor = vi.fn(async () => ({ ok: true, engagementId: "eng_99" }));
    const out = await executeRecommendation({ tenantId: "t1", recId: "r1" }, { prisma: s.prisma, runExecutor });
    expect(out.ok).toBe(true);
    expect(s.state.status).toBe("SENT");
    expect(s.state.hubspotEngagementId).toBe("eng_99");
  });

  it("re-execute of a SENT action is idempotent (no double send)", async () => {
    const s = recStore({ id: "r1", tenantId: "t1", actionType: "SEND_EMAIL", status: "SENT", hubspotEngagementId: "eng_99", payload: {} });
    const runExecutor = vi.fn();
    const out = await executeRecommendation({ tenantId: "t1", recId: "r1" }, { prisma: s.prisma, runExecutor });
    expect(out).toMatchObject({ ok: true, idempotent: true, hubspotEngagementId: "eng_99" });
    expect(runExecutor).not.toHaveBeenCalled();
  });

  it("internal action (PREP_MEETING) executes without approval", async () => {
    const s = recStore({ id: "r1", tenantId: "t1", actionType: "PREP_MEETING", title: "Prep", status: "DRAFTED", payload: { draft: { body: "brief" } } });
    const runExecutor = vi.fn(async () => ({ ok: true, internal: true, brief: "brief" }));
    const out = await executeRecommendation({ tenantId: "t1", recId: "r1" }, { prisma: s.prisma, runExecutor });
    expect(out.ok).toBe(true);
    expect(s.state.status).toBe("SENT");
  });

  it("executor failure -> FAILED with reason", async () => {
    const s = recStore({ id: "r1", tenantId: "t1", actionType: "UPDATE_CRM_CREATE_TASK", status: "DRAFTED", payload: {} });
    const runExecutor = vi.fn(async () => ({ ok: false, reason: "hubspot_unauthorized" }));
    const out = await executeRecommendation({ tenantId: "t1", recId: "r1" }, { prisma: s.prisma, runExecutor });
    expect(out).toMatchObject({ ok: false, reason: "hubspot_unauthorized", status: 502 });
    expect(s.state.status).toBe("FAILED");
  });

  it("approve transitions DRAFTED -> APPROVED", async () => {
    const s = recStore({ id: "r1", tenantId: "t1", actionType: "SEND_EMAIL", status: "DRAFTED", payload: {} });
    const out = await approveRecommendation({ tenantId: "t1", recId: "r1", actor: "ae@x.com" }, { prisma: s.prisma });
    expect(out.ok).toBe(true);
    expect(s.state.status).toBe("APPROVED");
  });
});

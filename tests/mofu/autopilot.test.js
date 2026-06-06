import { describe, it, expect, vi } from "vitest";
import { runAutopilot } from "@/lib/mofu/autopilot";

describe("autopilot (US-13.1 / D7)", () => {
  it("auto-executes an allowlisted internal action (no approve needed)", async () => {
    const draftRecommendation = vi.fn(async () => ({ ok: true }));
    const approveRecommendation = vi.fn(async () => ({ ok: true }));
    const executeRecommendation = vi.fn(async () => ({ ok: true }));
    const out = await runAutopilot(
      { tenantId: "t1", recommendations: [{ id: "r1", actionType: "PREP_MEETING" }] },
      { draftRecommendation, approveRecommendation, executeRecommendation }
    );
    expect(out.executed).toBe(1);
    expect(draftRecommendation).toHaveBeenCalled();
    expect(approveRecommendation).not.toHaveBeenCalled(); // internal, not outbound
    expect(executeRecommendation).toHaveBeenCalled();
  });

  it("approves NOTIFY_TEAM (outbound-classified but allowlisted) before executing", async () => {
    const approveRecommendation = vi.fn(async () => ({ ok: true }));
    const out = await runAutopilot(
      { tenantId: "t1", recommendations: [{ id: "r2", actionType: "NOTIFY_TEAM" }] },
      { draftRecommendation: vi.fn(async () => ({ ok: true })), approveRecommendation, executeRecommendation: vi.fn(async () => ({ ok: true })) }
    );
    expect(out.executed).toBe(1);
    expect(approveRecommendation).toHaveBeenCalled();
  });

  it("skips non-allowlisted (outbound) actions", async () => {
    const executeRecommendation = vi.fn(async () => ({ ok: true }));
    const out = await runAutopilot(
      { tenantId: "t1", recommendations: [{ id: "r3", actionType: "SEND_EMAIL" }] },
      { draftRecommendation: vi.fn(), approveRecommendation: vi.fn(), executeRecommendation }
    );
    expect(out.executed).toBe(0);
    expect(out.results[0]).toMatchObject({ skipped: true, reason: "not_allowlisted" });
    expect(executeRecommendation).not.toHaveBeenCalled();
  });
});

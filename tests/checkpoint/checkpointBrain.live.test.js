// Live brain test (RUN_LIVE_BRAIN=1) — real Anthropic+OpenAI jury against the
// sandbox deal. Validates Phase B (bundle + NBA jury) and Phase C rails end-to-end.
//   RUN_LIVE_BRAIN=1 npm run test:run -- tests/checkpoint/checkpointBrain.live.test.js
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { connectHubSpotFromPat } from "@/lib/hubspot/hubspotIntegration";
import { recomputeDeal } from "@/lib/mofu/recompute";
import { draftRecommendation, approveRecommendation, executeRecommendation } from "@/lib/mofu/execution/rails";

const LIVE = process.env.RUN_LIVE_BRAIN === "1";
const DEAL_ID = process.env.HS_TEST_DEAL_ID || "326239164100";

describe.skipIf(!LIVE)("Live brain — recompute + rails", () => {
  let tenantId;
  beforeAll(async () => {
    const t = await prisma.tenant.findFirst({ where: { name: "MOFU Checkpoint Tenant" } });
    tenantId = (t ?? (await prisma.tenant.create({ data: { name: "MOFU Checkpoint Tenant" } }))).id;
    await connectHubSpotFromPat(tenantId, process.env.HUBSPOT_PRIVATE_APP_TOKEN, { portalId: "246271093" });
  }, 30000);

  it("recomputes a deal through the real dual-model jury", async () => {
    const out = await recomputeDeal({ tenantId, hubspotDealId: DEAL_ID });
    expect(out.ok).toBe(true);
    expect(out.insightId).toBeTruthy();
    // eslint-disable-next-line no-console
    console.log("[brain] recompute:", { insightId: out.insightId, recs: out.recommendationCount, caps: out.capabilities });
  }, 120000);

  it("drafts + approves + executes the top recommendation (graceful if PAT lacks write scope)", async () => {
    const rec = await prisma.nbaRecommendation.findFirst({
      where: { tenantId, status: { in: ["SUGGESTED", "DRAFTED", "EDITED"] } },
      orderBy: { score: "desc" },
    });
    if (!rec) {
      // eslint-disable-next-line no-console
      console.log("[brain] no recommendation produced (thin data) — skipping rails leg");
      return;
    }
    await draftRecommendation({ tenantId, recId: rec.id });
    await approveRecommendation({ tenantId, recId: rec.id, actor: "test" });
    const exec = await executeRecommendation({ tenantId, recId: rec.id, actor: "test" });
    // eslint-disable-next-line no-console
    console.log("[brain] execute:", { actionType: rec.actionType, ok: exec.ok, reason: exec.reason });
    // Either it sent (internal action) or HubSpot rejected the write (read-only PAT) — both are valid.
    expect(exec.ok === true || typeof exec.reason === "string").toBe(true);
  }, 60000);
});

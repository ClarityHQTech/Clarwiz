// Checkpoint A (LIVE) — runs only with RUN_LIVE_CHECKPOINT=1 against the real
// local DB + the real HubSpot sandbox portal (PAT). Skipped in the normal suite.
//
//   RUN_LIVE_CHECKPOINT=1 npm run test:run -- tests/checkpoint
//
// Optional: HS_TEST_DEAL_ID=<id> (defaults to the sample deal in the sandbox).
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { connectHubSpotFromPat } from "@/lib/hubspot/hubspotIntegration";
import { hydrateDeal } from "@/lib/mofu/hydrateDeal";
import { ingestSignal } from "@/lib/mofu/ingestSignal";

const LIVE = process.env.RUN_LIVE_CHECKPOINT === "1";
const DEAL_ID = process.env.HS_TEST_DEAL_ID || "326239164100";
const TENANT_NAME = "MOFU Checkpoint Tenant";

describe.skipIf(!LIVE)("Checkpoint A — live hydrate + signal", () => {
  let tenantId;

  beforeAll(async () => {
    const existing = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
    const tenant = existing ?? (await prisma.tenant.create({ data: { name: TENANT_NAME } }));
    tenantId = tenant.id;
    await connectHubSpotFromPat(tenantId, process.env.HUBSPOT_PRIVATE_APP_TOKEN, {
      portalId: process.env.HUBSPOT_PORTAL_ID ?? null,
    });
  });

  it("hydrates the deal with a live stage from HubSpot", async () => {
    const out = await hydrateDeal({ tenantId, hubspotDealId: DEAL_ID });
    expect(out.ok).toBe(true);
    expect(typeof out.context.live.stage).toBe("string");
    expect(out.context.live.stage.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log("[checkpoint-a] live deal:", {
      dealId: out.dealId,
      stage: out.context.live.stage,
      amount: out.context.live.amount,
      currency: out.context.live.currency,
    });
  });

  it("re-hydrate refreshes live fields (no crash, idempotent pointer)", async () => {
    const a = await hydrateDeal({ tenantId, hubspotDealId: DEAL_ID });
    const b = await hydrateDeal({ tenantId, hubspotDealId: DEAL_ID });
    expect(a.dealId).toBe(b.dealId);
    expect(b.context.live.stage).toBe(a.context.live.stage);
  });

  it("turns a transcript into a scored DealSignal", async () => {
    const hydrate = await hydrateDeal({ tenantId, hubspotDealId: DEAL_ID });
    const out = await ingestSignal({
      tenantId,
      dealId: hydrate.dealId,
      kind: "CALL_TRANSCRIPT",
      source: "hubspot",
      externalId: "checkpoint_a_call_1",
      summary: "Discovery call — discussed pricing and timeline; positive intent.",
      occurredAt: new Date().toISOString(),
      intentHints: ["pricing", "timeline"],
    });
    expect(out.ok).toBe(true);
    expect(out.signal.score).toBeGreaterThan(0);
    expect(out.signal.signalReferenceId).toBe("hubspot:CALL_TRANSCRIPT:checkpoint_a_call_1");
    // eslint-disable-next-line no-console
    console.log("[checkpoint-a] scored signal:", {
      score: out.signal.score,
      ref: out.signal.signalReferenceId,
    });
  });
});

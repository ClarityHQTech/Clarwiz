import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { connectHubSpotFromPat } from "@/lib/hubspot/hubspotIntegration";
import { syncDealsFromHubSpot } from "@/lib/mofu/syncDeals";

describe.skipIf(process.env.RUN_LIVE_SYNC !== "1")("live sync deals", () => {
  it("hydrates all HubSpot deals", async () => {
    const t = await prisma.tenant.findFirst({ where: { name: "MOFU Checkpoint Tenant" } });
    await connectHubSpotFromPat(t.id, process.env.HUBSPOT_PRIVATE_APP_TOKEN, { portalId: "246271093" });
    const out = await syncDealsFromHubSpot({ tenantId: t.id, limit: 50 });
    // eslint-disable-next-line no-console
    console.log("[sync]", out);
    expect(out.ok).toBe(true);
  }, 60000);
});

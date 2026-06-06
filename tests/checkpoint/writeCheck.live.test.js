// Live write check (RUN_LIVE_WRITE=1) — confirms which HubSpot writes the token allows.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { connectHubSpotFromPat } from "@/lib/hubspot/hubspotIntegration";
import { hubspotAdapter } from "@/lib/sor/hubspotAdapter";

const LIVE = process.env.RUN_LIVE_WRITE === "1";
const DEAL = process.env.HS_TEST_DEAL_ID || "326239164100";

describe.skipIf(!LIVE)("live write check", () => {
  let tenantId;
  beforeAll(async () => {
    const t = await prisma.tenant.findFirst({ where: { name: "MOFU Checkpoint Tenant" } });
    tenantId = t.id;
    await connectHubSpotFromPat(tenantId, process.env.HUBSPOT_PRIVATE_APP_TOKEN, { portalId: "246271093" });
  }, 30000);

  it("reports which writes succeed", async () => {
    const task = await hubspotAdapter.createTask(tenantId, { dealId: DEAL, title: "Clarwiz write-check", body: "test" });
    const note = await hubspotAdapter.createNote(tenantId, { dealId: DEAL, body: "Clarwiz write-check note" });
    const email = await hubspotAdapter.logEmail(tenantId, { dealId: DEAL, subject: "Clarwiz write-check", body: "test", toEmail: "bh@hubspot.com" });
    const meeting = await hubspotAdapter.createMeeting(tenantId, { dealId: DEAL, title: "Clarwiz write-check meeting" });
    // eslint-disable-next-line no-console
    console.log("[write-check]", {
      task: task.ok ? "OK" : task.reason,
      note: note.ok ? "OK" : note.reason,
      email: email.ok ? "OK" : email.reason,
      meeting: meeting.ok ? "OK" : meeting.reason,
    });
    expect(true).toBe(true);
  }, 60000);
});

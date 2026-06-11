import { describe, it, expect } from "vitest";
import {
  buildDealCreateBody,
  buildTaskBody,
  buildNoteBody,
  createDeal,
  addNote,
} from "./hubspotWrite.js";

describe("buildDealCreateBody", () => {
  it("maps fields to HubSpot deal properties", () => {
    const b = buildDealCreateBody({ name: "Acme — New", stageId: "s1", amount: 1000, ownerId: "OW1", pipeline: "default" });
    expect(b.properties.dealname).toBe("Acme — New");
    expect(b.properties.dealstage).toBe("s1");
    expect(b.properties.amount).toBe("1000");
    expect(b.properties.hubspot_owner_id).toBe("OW1");
    expect(b.properties.pipeline).toBe("default");
  });
  it("omits empty optional properties", () => {
    const b = buildDealCreateBody({ name: "X", stageId: "s1" });
    expect(b.properties.amount).toBeUndefined();
    expect(b.properties.hubspot_owner_id).toBeUndefined();
  });
  it("stamps clarwiz campaign contact id when provided", () => {
    const b = buildDealCreateBody({ name: "X", stageId: "s1", campaignContactId: "cc-99" });
    expect(b.properties.clarwiz_campaign_contact_id).toBe("cc-99");
  });
});

describe("buildTaskBody / buildNoteBody", () => {
  it("builds a task with subject + body", () => {
    const b = buildTaskBody({ subject: "Follow up", body: "Send ROI deck", timestamp: 1000 });
    expect(b.properties.hs_task_subject).toBe("Follow up");
    expect(b.properties.hs_task_body).toBe("Send ROI deck");
    expect(b.properties.hs_timestamp).toBe(1000);
    expect(b.properties.hs_task_status).toBe("NOT_STARTED");
  });
  it("builds a note", () => {
    const b = buildNoteBody({ body: "Created from Clarwiz MOFU", timestamp: 2000 });
    expect(b.properties.hs_note_body).toBe("Created from Clarwiz MOFU");
    expect(b.properties.hs_timestamp).toBe(2000);
  });
});

describe("createDeal / addNote (injected fetch)", () => {
  it("POSTs the deal and returns its id", async () => {
    let captured;
    const fetchImpl = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 201, json: async () => ({ id: "NEWDEAL" }) };
    };
    const res = await createDeal("tok", { name: "X", stageId: "s1" }, { fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.id).toBe("NEWDEAL");
    expect(captured.url).toContain("/crm/v3/objects/deals");
    expect(captured.opts.headers.Authorization).toBe("Bearer tok");
  });

  it("returns ok:false (no throw) on a write failure", async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ message: "forbidden" }) });
    const res = await addNote("tok", { dealId: "D1", body: "hi" }, { fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });
});

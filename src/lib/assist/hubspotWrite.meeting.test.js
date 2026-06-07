import { describe, it, expect } from "vitest";
import { buildMeetingBody, createMeeting } from "./hubspotWrite.js";

describe("buildMeetingBody", () => {
  it("maps fields to HubSpot meeting properties with SCHEDULED outcome", () => {
    const start = Date.parse("2026-06-10T10:00:00Z");
    const end = Date.parse("2026-06-10T10:30:00Z");
    const b = buildMeetingBody({
      title: "Acme demo",
      body: "Walk through the platform",
      startTime: start,
      endTime: end,
    });
    expect(b.properties.hs_meeting_title).toBe("Acme demo");
    expect(b.properties.hs_meeting_body).toBe("Walk through the platform");
    expect(b.properties.hs_meeting_outcome).toBe("SCHEDULED");
    expect(b.properties.hs_meeting_start_time).toBe(start);
    expect(b.properties.hs_meeting_end_time).toBe(end);
    expect(b.properties.hs_timestamp).toBe(start);
  });

  it("normalizes ISO-string start/end to epoch ms", () => {
    const iso = "2026-06-10T10:00:00.000Z";
    const b = buildMeetingBody({ title: "X", body: "", startTime: iso, endTime: iso });
    expect(b.properties.hs_meeting_start_time).toBe(Date.parse(iso));
  });

  it("omits start/end when not provided and defaults timestamp", () => {
    const b = buildMeetingBody({ title: "X" });
    expect(b.properties.hs_meeting_start_time).toBeUndefined();
    expect(b.properties.hs_meeting_end_time).toBeUndefined();
    expect(typeof b.properties.hs_timestamp).toBe("number");
  });
});

describe("createMeeting (injected fetch)", () => {
  it("creates the meeting and associates it to the deal and contacts", async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, method: opts.method });
      if (url.includes("/crm/v3/objects/meetings")) {
        return { ok: true, status: 201, json: async () => ({ id: "MEET1" }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const res = await createMeeting(
      "tok",
      { dealId: "D1", contactIds: ["C1", "C2"], title: "Demo", body: "", startTime: Date.now() },
      { fetchImpl }
    );
    expect(res.ok).toBe(true);
    expect(res.id).toBe("MEET1");
    // one create + one deal association + two contact associations
    expect(calls[0].url).toContain("/crm/v3/objects/meetings");
    expect(calls.some((c) => c.url.includes("/crm/v4/objects/deals/D1/associations/default/meetings/MEET1"))).toBe(true);
    expect(calls.filter((c) => c.url.includes("/associations/default/contacts/")).length).toBe(2);
  });

  it("returns write_scope reason (no throw) on a 403", async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ message: "forbidden" }) });
    const res = await createMeeting("tok", { dealId: "D1", title: "Demo" }, { fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("write_scope");
    expect(res.status).toBe(403);
  });

  it("returns hubspot_error on a non-403 failure", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const res = await createMeeting("tok", { dealId: "D1", title: "Demo" }, { fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("hubspot_error");
    expect(res.status).toBe(500);
  });
});

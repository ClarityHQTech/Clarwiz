import { describe, it, expect } from "vitest";
import { getTofuTimeline, firstOpenStageId } from "./tofuTimeline.js";

// A fake prisma whose communicationLog.findMany captures the `where` it is called
// with and returns a fixed fixture set, so we can assert both the query shape
// (tenant + email scoping) and the mapping logic without a real DB.
function fakePrisma(logs, capture = {}) {
  return {
    communicationLog: {
      findMany: async (args) => {
        capture.args = args;
        return logs;
      },
    },
  };
}

describe("getTofuTimeline", () => {
  it("returns [] immediately when email is missing (no DB call)", async () => {
    let called = false;
    const prisma = { communicationLog: { findMany: async () => ((called = true), []) } };
    expect(await getTofuTimeline(prisma, "t1", null)).toEqual([]);
    expect(await getTofuTimeline(prisma, "t1", "")).toEqual([]);
    expect(await getTofuTimeline(prisma, "t1", undefined)).toEqual([]);
    expect(called).toBe(false);
  });

  it("lowercases the email and scopes the query by tenant + businessUser email", async () => {
    const capture = {};
    const prisma = fakePrisma([], capture);
    await getTofuTimeline(prisma, "t1", "Jane.Doe@ACME.com");
    expect(capture.args.where.tenantId).toBe("t1");
    expect(capture.args.where.contactCampaign.contact.businessUser.email).toBe("jane.doe@acme.com");
    expect(capture.args.orderBy).toEqual({ sentAt: "desc" });
  });

  it("maps an outbound-only log to a single outbound entry", async () => {
    const sentAt = new Date("2026-05-01T10:00:00Z");
    const prisma = fakePrisma([
      {
        id: "c1",
        channel: "email",
        subject: "Intro to Clarwiz",
        message: "Hi there",
        ctaType: "book_demo",
        status: "sent",
        responseType: null,
        responseAt: null,
        sentAt,
      },
    ]);
    const out = await getTofuTimeline(prisma, "t1", "jane@acme.com");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "c1",
      channel: "email",
      direction: "outbound",
      subject: "Intro to Clarwiz",
      cta: "book_demo",
      status: "sent",
      timestamp: sentAt,
    });
  });

  it("emits both an outbound and an inbound entry when the log has a response", async () => {
    const sentAt = new Date("2026-05-01T10:00:00Z");
    const responseAt = new Date("2026-05-02T09:00:00Z");
    const prisma = fakePrisma([
      {
        id: "c2",
        channel: "linkedin",
        subject: "Following up",
        message: "Any thoughts?",
        ctaType: "reply",
        status: "delivered",
        responseType: "positive",
        responseAt,
        sentAt,
      },
    ]);
    const out = await getTofuTimeline(prisma, "t1", "jane@acme.com");
    expect(out).toHaveLength(2);
    // Newest-first overall: the inbound reply (later) comes before the outbound send.
    const inbound = out.find((e) => e.direction === "inbound");
    const outbound = out.find((e) => e.direction === "outbound");
    expect(inbound).toMatchObject({
      id: "c2",
      channel: "linkedin",
      direction: "inbound",
      status: "positive",
      timestamp: responseAt,
    });
    expect(outbound).toMatchObject({ direction: "outbound", timestamp: sentAt });
    expect(out[0].timestamp.getTime()).toBeGreaterThanOrEqual(out[1].timestamp.getTime());
  });

  it("orders all entries newest-first across multiple logs", async () => {
    const prisma = fakePrisma([
      { id: "b", channel: "email", sentAt: new Date("2026-05-10T00:00:00Z"), status: "sent" },
      { id: "a", channel: "email", sentAt: new Date("2026-05-01T00:00:00Z"), status: "sent" },
    ]);
    const out = await getTofuTimeline(prisma, "t1", "jane@acme.com");
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("firstOpenStageId", () => {
  it("returns the lowest-displayOrder non-closed stage across pipelines", () => {
    const pipelines = {
      results: [
        {
          stages: [
            { id: "qual", label: "Qualified", displayOrder: 1, metadata: { isClosed: "false" } },
            { id: "appt", label: "Appointment", displayOrder: 0, metadata: { isClosed: "false" } },
            { id: "won", label: "Closed Won", displayOrder: 2, metadata: { isClosed: "true" } },
          ],
        },
      ],
    };
    expect(firstOpenStageId(pipelines)).toBe("appt");
  });

  it("falls back to the first stage if every stage is closed", () => {
    const pipelines = {
      results: [
        {
          stages: [
            { id: "won", label: "Won", displayOrder: 0, metadata: { isClosed: "true" } },
            { id: "lost", label: "Lost", displayOrder: 1, metadata: { isClosed: "true" } },
          ],
        },
      ],
    };
    expect(firstOpenStageId(pipelines)).toBe("won");
  });

  it("returns null when there are no pipelines/stages", () => {
    expect(firstOpenStageId({ results: [] })).toBeNull();
    expect(firstOpenStageId(null)).toBeNull();
    expect(firstOpenStageId({ results: [{ stages: [] }] })).toBeNull();
  });
});

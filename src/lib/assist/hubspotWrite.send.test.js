import { describe, it, expect } from "vitest";
import { buildEmailEngagementBody, logEmailEngagement } from "./hubspotWrite.js";

describe("buildEmailEngagementBody", () => {
  it("maps subject/html/timestamp to logged-email properties", () => {
    const b = buildEmailEngagementBody({ subject: "Hi", html: "<p>x</p>", timestamp: 1234 });
    expect(b.properties.hs_email_subject).toBe("Hi");
    expect(b.properties.hs_email_html).toBe("<p>x</p>");
    expect(b.properties.hs_email_direction).toBe("EMAIL");
    expect(b.properties.hs_timestamp).toBe(1234);
  });

  it("defaults missing fields safely", () => {
    const b = buildEmailEngagementBody({});
    expect(b.properties.hs_email_subject).toBe("");
    expect(b.properties.hs_email_html).toBe("");
    expect(typeof b.properties.hs_timestamp).toBe("number");
  });
});

describe("logEmailEngagement (injected fetch)", () => {
  it("creates the email object and associates it to the deal and contact", async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, method: opts.method ?? "POST" });
      if (url.endsWith("/crm/v3/objects/emails")) {
        return { ok: true, status: 201, json: async () => ({ id: "EM1" }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const res = await logEmailEngagement(
      "tok",
      { dealId: "D1", contactId: "C1", subject: "Hi", html: "<p>x</p>", timestamp: 1 },
      { fetchImpl }
    );

    expect(res.ok).toBe(true);
    expect(res.id).toBe("EM1");

    // create
    expect(calls[0].url).toContain("/crm/v3/objects/emails");
    // deal association fires
    expect(
      calls.some(
        (c) =>
          c.method === "PUT" &&
          c.url.includes("/crm/v4/objects/emails/EM1/associations/default/deals/D1")
      )
    ).toBe(true);
    // contact association fires
    expect(
      calls.some(
        (c) =>
          c.method === "PUT" &&
          c.url.includes("/crm/v4/objects/emails/EM1/associations/default/contacts/C1")
      )
    ).toBe(true);
  });

  it("skips contact association when no contactId is given", async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, method: opts.method ?? "POST" });
      if (url.endsWith("/crm/v3/objects/emails")) {
        return { ok: true, status: 201, json: async () => ({ id: "EM2" }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const res = await logEmailEngagement("tok", { dealId: "D1", subject: "S", html: "<p>y</p>" }, { fetchImpl });
    expect(res.ok).toBe(true);
    expect(calls.some((c) => c.url.includes("/contacts/"))).toBe(false);
  });

  it("returns ok:false (no throw, no association) on a 403 missing-scope create", async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, method: opts.method ?? "POST" });
      return { ok: false, status: 403, json: async () => ({ message: "forbidden" }) };
    };

    const res = await logEmailEngagement(
      "tok",
      { dealId: "D1", contactId: "C1", subject: "Hi", html: "<p>x</p>" },
      { fetchImpl }
    );

    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.id).toBeNull();
    // no association attempts after a failed create
    expect(calls).toHaveLength(1);
  });

  it("never throws if fetch itself rejects", async () => {
    const fetchImpl = async () => {
      throw new Error("network down");
    };
    const res = await logEmailEngagement("tok", { dealId: "D1", subject: "S", html: "H" }, { fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
  });
});

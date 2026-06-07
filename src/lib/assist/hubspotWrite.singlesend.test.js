import { describe, it, expect } from "vitest";
import { buildSingleSendBody, sendSingleSendEmail } from "./hubspotWrite.js";

describe("buildSingleSendBody", () => {
  it("coerces emailId to a Number and maps subject/html to custom properties", () => {
    const b = buildSingleSendBody({
      emailId: "12345",
      to: "person@x.com",
      subject: "Hello",
      html: "<p>hi</p>",
    });
    expect(b.emailId).toBe(12345);
    expect(typeof b.emailId).toBe("number");
    expect(b.message.to).toBe("person@x.com");
    expect(b.customProperties.subject).toBe("Hello");
    expect(b.customProperties.body).toBe("<p>hi</p>");
  });

  it("includes replyTo only when provided (as an array)", () => {
    const withReply = buildSingleSendBody({
      emailId: 7,
      to: "a@b.com",
      subject: "S",
      html: "H",
      replyTo: "rep@x.com",
    });
    expect(withReply.message.replyTo).toEqual(["rep@x.com"]);

    const arrReply = buildSingleSendBody({
      emailId: 7,
      to: "a@b.com",
      subject: "S",
      html: "H",
      replyTo: ["one@x.com", "two@x.com"],
    });
    expect(arrReply.message.replyTo).toEqual(["one@x.com", "two@x.com"]);

    const noReply = buildSingleSendBody({ emailId: 7, to: "a@b.com", subject: "S", html: "H" });
    expect(noReply.message.replyTo).toBeUndefined();
  });

  it("defaults missing subject/html safely", () => {
    const b = buildSingleSendBody({ emailId: 1, to: "a@b.com" });
    expect(b.customProperties.subject).toBe("");
    expect(b.customProperties.body).toBe("");
  });
});

describe("sendSingleSendEmail (injected fetch)", () => {
  it("POSTs the single-send endpoint and returns ok with status/statusId on success", async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        status: 200,
        json: async () => ({ statusId: "abc-123", status: "PENDING", sendResult: "SENT" }),
      };
    };

    const res = await sendSingleSendEmail(
      "tok",
      { emailId: "55", to: "person@x.com", subject: "Hi", html: "<p>x</p>", replyTo: "rep@x.com" },
      { fetchImpl }
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe("PENDING");
    expect(res.statusId).toBe("abc-123");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.hubapi.com/marketing/v3/transactional/single-email/send"
    );
    expect(calls[0].opts.method).toBe("POST");
    expect(calls[0].opts.headers.Authorization).toBe("Bearer tok");
    const sent = JSON.parse(calls[0].opts.body);
    expect(sent.emailId).toBe(55);
    expect(sent.message.to).toBe("person@x.com");
    expect(sent.message.replyTo).toEqual(["rep@x.com"]);
    expect(sent.customProperties).toEqual({ subject: "Hi", body: "<p>x</p>" });
  });

  it("returns reason:write_scope on a 403 (missing transactional-email scope)", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "forbidden" }),
    });
    const res = await sendSingleSendEmail(
      "tok",
      { emailId: 55, to: "a@b.com", subject: "S", html: "H" },
      { fetchImpl }
    );
    expect(res).toEqual({ ok: false, reason: "write_scope" });
  });

  it("returns reason:send_failed with status/message on a 400 (bad emailId/template)", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ message: "invalid emailId" }),
    });
    const res = await sendSingleSendEmail(
      "tok",
      { emailId: 999, to: "a@b.com", subject: "S", html: "H" },
      { fetchImpl }
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("send_failed");
    expect(res.status).toBe(400);
    expect(res.message).toBe("invalid emailId");
  });

  it("never throws if fetch itself rejects", async () => {
    const fetchImpl = async () => {
      throw new Error("network down");
    };
    const res = await sendSingleSendEmail(
      "tok",
      { emailId: 1, to: "a@b.com", subject: "S", html: "H" },
      { fetchImpl }
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("send_failed");
  });
});

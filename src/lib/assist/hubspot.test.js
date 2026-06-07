import { describe, it, expect } from "vitest";
import { verifyHubspotToken } from "./hubspot.js";

describe("verifyHubspotToken", () => {
  it("returns ok:true on a 200 from HubSpot", async () => {
    const fetchImpl = async () => ({ ok: true, status: 200 });
    const res = await verifyHubspotToken("pat-na2-good", { fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns ok:false with the status on a 401", async () => {
    const fetchImpl = async () => ({ ok: false, status: 401 });
    const res = await verifyHubspotToken("pat-na2-bad", { fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
  });

  it("calls the contacts endpoint with a Bearer Authorization header", async () => {
    let captured;
    const fetchImpl = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200 };
    };
    await verifyHubspotToken("pat-na2-xyz", { fetchImpl });
    expect(captured.url).toContain("/crm/v3/objects/contacts");
    expect(captured.opts.headers.Authorization).toBe("Bearer pat-na2-xyz");
  });

  it("returns ok:false on a network error instead of throwing", async () => {
    const fetchImpl = async () => {
      throw new Error("network down");
    };
    const res = await verifyHubspotToken("t", { fetchImpl });
    expect(res.ok).toBe(false);
  });
});

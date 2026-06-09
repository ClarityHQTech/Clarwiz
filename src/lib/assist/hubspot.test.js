import { describe, it, expect, vi } from "vitest";
import {
  verifyHubspotToken,
  resolveOwnerIdByEmail,
  buildOwnersByEmailUrl,
} from "./hubspot.js";

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

describe("buildOwnersByEmailUrl", () => {
  it("targets the owners endpoint with an email query param", () => {
    const url = buildOwnersByEmailUrl("ae@example.com");
    expect(url).toBe("https://api.hubapi.com/crm/v3/owners/?email=ae%40example.com");
  });

  it("url-encodes special characters in the email", () => {
    const url = buildOwnersByEmailUrl("a+b@example.com");
    expect(url).toContain("email=a%2Bb%40example.com");
  });
});

describe("resolveOwnerIdByEmail", () => {
  it("returns the first owner id as a string on a match", async () => {
    let captured;
    const fetchImpl = async (url, opts) => {
      captured = { url, opts };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: 42, email: "ae@example.com", archived: false }],
        }),
      };
    };
    const id = await resolveOwnerIdByEmail("tok", "ae@example.com", { fetchImpl });
    expect(id).toBe("42");
    expect(captured.url).toContain("/crm/v3/owners/?email=ae%40example.com");
    expect(captured.opts.headers.Authorization).toBe("Bearer tok");
  });

  it("returns null when no owner matches the email", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    });
    const id = await resolveOwnerIdByEmail("tok", "nobody@example.com", { fetchImpl });
    expect(id).toBeNull();
  });

  it("returns null (and warns) on a 403 missing-scope response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "missing scope" }),
    });
    const id = await resolveOwnerIdByEmail("tok", "ae@example.com", { fetchImpl });
    expect(id).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain("[MOFU] owners");
    warn.mockRestore();
  });

  it("returns null instead of throwing on a network error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = async () => {
      throw new Error("network down");
    };
    const id = await resolveOwnerIdByEmail("tok", "ae@example.com", { fetchImpl });
    expect(id).toBeNull();
    warn.mockRestore();
  });

  it("returns null for a falsy email without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const id = await resolveOwnerIdByEmail("tok", "", { fetchImpl });
    expect(id).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from "vitest";
import { hubspotFetch } from "@/lib/hubspot/hubspotClient";

function resp(status, json) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json),
  };
}

describe("hubspotFetch", () => {
  it("retries on 500 then succeeds (max 3, exp backoff)", async () => {
    const calls = [resp(500, {}), resp(500, {}), resp(200, { id: "d1" })];
    const fakeFetch = vi.fn(async () => calls.shift());
    const out = await hubspotFetch("/crm/v3/objects/deals/d1", {
      accessToken: "t",
      fetchImpl: fakeFetch,
      sleep: async () => {},
    });
    expect(out).toEqual({ id: "d1" });
    expect(fakeFetch).toHaveBeenCalledTimes(3);
  });

  it("gives up after 3 failures with a structured error", async () => {
    const fakeFetch = vi.fn(async () => resp(503, {}));
    await expect(
      hubspotFetch("/x", { accessToken: "t", fetchImpl: fakeFetch, sleep: async () => {} })
    ).rejects.toMatchObject({ code: "hubspot_unavailable", status: 503 });
    expect(fakeFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry on a non-retryable 401 (surfaces unauthorized immediately)", async () => {
    const fakeFetch = vi.fn(async () => resp(401, {}));
    await expect(
      hubspotFetch("/x", { accessToken: "bad", fetchImpl: fakeFetch, sleep: async () => {} })
    ).rejects.toMatchObject({ code: "hubspot_unauthorized" });
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });
});

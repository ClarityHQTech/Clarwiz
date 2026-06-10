import { describe, it, expect, beforeEach } from "vitest";
import {
  isHubspotOAuthConnected,
  toDisplayConfig,
  getDecryptedHubspotToken,
  buildTokenExchangeBody,
  buildTokenRefreshBody,
  getHubspotAccessToken,
  upsertHubspotOAuth,
} from "./mofuIntegration.js";
import { encryptMofuToken, decryptMofuToken } from "@/lib/encryptSecret";

describe("isHubspotOAuthConnected", () => {
  it("returns false for null or non-oauth rows", () => {
    expect(isHubspotOAuthConnected(null)).toBe(false);
    expect(isHubspotOAuthConnected({ connectionMode: "pat" })).toBe(false);
    expect(isHubspotOAuthConnected({ connectionMode: "oauth" })).toBe(false);
  });
  it("returns true when oauth access or refresh token is stored", () => {
    expect(
      isHubspotOAuthConnected({
        connectionMode: "oauth",
        encryptedHubspotAccessToken: encryptMofuToken("acc"),
      })
    ).toBe(true);
    expect(
      isHubspotOAuthConnected({
        connectionMode: "oauth",
        encryptedHubspotRefreshToken: encryptMofuToken("ref"),
      })
    ).toBe(true);
  });
});

describe("toDisplayConfig", () => {
  it("returns not-configured for a null row", () => {
    expect(toDisplayConfig(null)).toEqual({ configured: false });
  });
  it("returns configured=false for a row without oauth tokens", () => {
    const out = toDisplayConfig({ connectionMode: "pat", status: "connected" });
    expect(out.configured).toBe(false);
  });
  it("exposes singleSendEmailId and canDeliverEmail=true when an id is set", () => {
    const out = toDisplayConfig({
      connectionMode: "oauth",
      encryptedHubspotAccessToken: encryptMofuToken("acc"),
      hubspotSingleSendEmailId: "987",
      status: "connected",
    });
    expect(out.configured).toBe(true);
    expect(out.singleSendEmailId).toBe("987");
    expect(out.canDeliverEmail).toBe(true);
  });
  it("canDeliverEmail=false and singleSendEmailId=null when no id is set", () => {
    const out = toDisplayConfig({
      connectionMode: "oauth",
      encryptedHubspotAccessToken: encryptMofuToken("acc"),
      status: "connected",
    });
    expect(out.singleSendEmailId).toBeNull();
    expect(out.canDeliverEmail).toBe(false);
  });
});

describe("getDecryptedHubspotToken", () => {
  it("returns null when the tenant has no integration", async () => {
    const prisma = { mofuIntegration: { findUnique: async () => null } };
    expect(await getDecryptedHubspotToken(prisma, "t")).toBeNull();
  });
  it("returns null for non-oauth integrations", async () => {
    const row = { encryptedHubspotToken: encryptMofuToken("pat-legacy") };
    const prisma = { mofuIntegration: { findUnique: async () => row } };
    expect(await getDecryptedHubspotToken(prisma, "t")).toBeNull();
  });
  it("delegates to OAuth path when connectionMode is oauth", async () => {
    const row = {
      connectionMode: "oauth",
      encryptedHubspotAccessToken: encryptMofuToken("oauth-access-tok"),
      hubspotTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    const prisma = { mofuIntegration: { findUnique: async () => row } };
    const noFetch = () => {
      throw new Error("should not fetch");
    };
    expect(await getDecryptedHubspotToken(prisma, "t", { fetchImpl: noFetch })).toBe(
      "oauth-access-tok"
    );
  });
});

describe("buildTokenExchangeBody", () => {
  beforeEach(() => {
    process.env.HUBSPOT_CLIENT_ID = "cid";
    process.env.HUBSPOT_CLIENT_SECRET = "csecret";
    process.env.HUBSPOT_REDIRECT_URI = "http://localhost:3000/cb";
  });
  it("builds a urlencoded authorization_code body from env + code", () => {
    const body = buildTokenExchangeBody({ code: "the-code" });
    const params = new URLSearchParams(body);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("client_id")).toBe("cid");
    expect(params.get("client_secret")).toBe("csecret");
    expect(params.get("redirect_uri")).toBe("http://localhost:3000/cb");
    expect(params.get("code")).toBe("the-code");
  });
});

describe("buildTokenRefreshBody", () => {
  beforeEach(() => {
    process.env.HUBSPOT_CLIENT_ID = "cid";
    process.env.HUBSPOT_CLIENT_SECRET = "csecret";
  });
  it("builds a urlencoded refresh_token body from env + refreshToken", () => {
    const body = buildTokenRefreshBody({ refreshToken: "rt-123" });
    const params = new URLSearchParams(body);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("client_id")).toBe("cid");
    expect(params.get("client_secret")).toBe("csecret");
    expect(params.get("refresh_token")).toBe("rt-123");
  });
});

describe("getHubspotAccessToken", () => {
  beforeEach(() => {
    process.env.HUBSPOT_CLIENT_ID = "cid";
    process.env.HUBSPOT_CLIENT_SECRET = "csecret";
    process.env.HUBSPOT_REDIRECT_URI = "http://localhost:3000/cb";
  });

  it("returns null for legacy PAT rows", async () => {
    const row = {
      connectionMode: "pat",
      encryptedHubspotToken: encryptMofuToken("pat-na2-x"),
    };
    const prisma = { mofuIntegration: { findUnique: async () => row } };
    expect(await getHubspotAccessToken(prisma, "t")).toBeNull();
  });

  it("oauth valid path: returns cached access token without refreshing", async () => {
    const row = {
      connectionMode: "oauth",
      encryptedHubspotAccessToken: encryptMofuToken("cached-access"),
      encryptedHubspotRefreshToken: encryptMofuToken("rt"),
      hubspotTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
    const prisma = { mofuIntegration: { findUnique: async () => row } };
    let fetched = false;
    const fetchImpl = async () => {
      fetched = true;
      return { ok: true, json: async () => ({}) };
    };
    const tok = await getHubspotAccessToken(prisma, "t", { fetchImpl });
    expect(tok).toBe("cached-access");
    expect(fetched).toBe(false);
  });

  it("oauth expired path: refreshes, stores new tokens, returns the fresh access token", async () => {
    const row = {
      connectionMode: "oauth",
      encryptedHubspotAccessToken: encryptMofuToken("stale-access"),
      encryptedHubspotRefreshToken: encryptMofuToken("rt-old"),
      hubspotTokenExpiresAt: new Date(Date.now() - 1000), // expired
    };
    let updated;
    const prisma = {
      mofuIntegration: {
        findUnique: async () => row,
        update: async (args) => {
          updated = args;
          return { ...row, ...args.data };
        },
      },
    };
    const fetchImpl = async (url, opts) => {
      expect(url).toContain("oauth/v1/token");
      expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      const params = new URLSearchParams(opts.body);
      expect(params.get("grant_type")).toBe("refresh_token");
      expect(params.get("refresh_token")).toBe("rt-old");
      return {
        ok: true,
        json: async () => ({
          access_token: "fresh-access",
          refresh_token: "rt-new",
          expires_in: 1800,
          token_type: "bearer",
        }),
      };
    };
    const tok = await getHubspotAccessToken(prisma, "t", { fetchImpl });
    expect(tok).toBe("fresh-access");
    expect(updated.where).toEqual({ tenantId: "t" });
    expect(decryptMofuToken(updated.data.encryptedHubspotAccessToken)).toBe("fresh-access");
    expect(decryptMofuToken(updated.data.encryptedHubspotRefreshToken)).toBe("rt-new");
    expect(updated.data.hubspotTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("oauth refresh failure: returns null and does not throw", async () => {
    const row = {
      connectionMode: "oauth",
      encryptedHubspotAccessToken: encryptMofuToken("stale"),
      encryptedHubspotRefreshToken: encryptMofuToken("rt"),
      hubspotTokenExpiresAt: new Date(Date.now() - 1000),
    };
    const prisma = {
      mofuIntegration: { findUnique: async () => row, update: async () => row },
    };
    const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({}) });
    expect(await getHubspotAccessToken(prisma, "t", { fetchImpl })).toBeNull();
  });

  it("returns null when there is no integration row", async () => {
    const prisma = { mofuIntegration: { findUnique: async () => null } };
    expect(await getHubspotAccessToken(prisma, "t")).toBeNull();
  });
});

describe("upsertHubspotOAuth", () => {
  it("upserts encrypted oauth tokens with connectionMode oauth and connected status", async () => {
    let captured;
    const prisma = {
      mofuIntegration: {
        upsert: async (args) => {
          captured = args;
          return { id: "1" };
        },
      },
    };
    await upsertHubspotOAuth(prisma, "tenant-9", {
      accessToken: "acc",
      refreshToken: "ref",
      expiresIn: 1800,
      portalId: "555",
      scopes: ["crm.objects.deals.read", "oauth"],
    });
    expect(captured.where).toEqual({ tenantId: "tenant-9" });
    for (const data of [captured.create, captured.update]) {
      expect(data.connectionMode).toBe("oauth");
      expect(data.status).toBe("connected");
      expect(data.hubspotPortalId).toBe("555");
      expect(data.hubspotScopes).toEqual(["crm.objects.deals.read", "oauth"]);
      expect(decryptMofuToken(data.encryptedHubspotAccessToken)).toBe("acc");
      expect(decryptMofuToken(data.encryptedHubspotRefreshToken)).toBe("ref");
      expect(data.hubspotTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(data.connectedAt).toBeInstanceOf(Date);
    }
    expect(captured.create.tenantId).toBe("tenant-9");
  });
});

describe("toDisplayConfig OAuth fields", () => {
  it("exposes connectionMode, portalId, scopes, and scopeCount", () => {
    const row = {
      connectionMode: "oauth",
      encryptedHubspotAccessToken: encryptMofuToken("acc"),
      hubspotPortalId: "987",
      hubspotScopes: ["a", "b", "c"],
      status: "connected",
      connectedAt: null,
    };
    const out = toDisplayConfig(row);
    expect(out.connectionMode).toBe("oauth");
    expect(out.hubspotPortalId).toBe("987");
    expect(out.hubspotScopes).toEqual(["a", "b", "c"]);
    expect(out.scopeCount).toBe(3);
    expect(out.configured).toBe(true);
  });
});

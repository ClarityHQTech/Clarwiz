import { encryptMofuToken, decryptMofuToken } from "@/lib/encryptSecret";

/**
 * MOFU integration credential store. One row per tenant (`MofuIntegration`).
 *
 * A tenant connects HubSpot in one of two modes:
 *  - `oauth`: each portal installs the app via "Connect HubSpot". We persist an
 *    encrypted access token + refresh token and auto-refresh on expiry.
 *  - `pat` (default / fallback): a manually pasted private-app token.
 *
 * All credentials are stored AES-256-GCM encrypted and never leave the server
 * in plaintext — display paths mask or omit them.
 */

const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
// Refresh slightly before the real expiry so in-flight calls never use a dead token.
const TOKEN_EXPIRY_MARGIN_MS = 120 * 1000;

/** Mask a secret for display: `••••WXYZ`. Returns null for empty input. */
export function maskToken(token) {
  if (!token) return null;
  return `••••${String(token).slice(-4)}`;
}

/**
 * Shape the persisted columns from raw form input, encrypting the token.
 * Pure (no DB) so it is unit-testable. Throws if the token is missing.
 */
export function buildMofuIntegrationData({
  hubspotToken,
  hubspotPortalId = null,
  defaultOwnerId = null,
  insightModel = null,
} = {}) {
  if (!hubspotToken) {
    throw new Error("hubspotToken is required");
  }
  return {
    encryptedHubspotToken: encryptMofuToken(hubspotToken),
    hubspotPortalId: hubspotPortalId || null,
    defaultOwnerId: defaultOwnerId || null,
    insightModel: insightModel || null,
  };
}

/** Upsert a tenant's MOFU integration (status lifecycle is owned by the route after verification). */
export async function upsertMofuIntegration(prisma, tenantId, input) {
  const data = buildMofuIntegrationData(input);
  return prisma.mofuIntegration.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

export async function getMofuIntegration(prisma, tenantId) {
  return prisma.mofuIntegration.findUnique({ where: { tenantId } });
}

/**
 * Pure form-body builder for the OAuth authorization_code exchange.
 * Reads client id/secret/redirect from env. Returns a URLSearchParams string.
 */
export function buildTokenExchangeBody({ code }) {
  return new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
    client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI ?? "",
    code: code ?? "",
  }).toString();
}

/**
 * Pure form-body builder for the OAuth refresh_token grant.
 * Reads client id/secret from env. Returns a URLSearchParams string.
 */
export function buildTokenRefreshBody({ refreshToken }) {
  return new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
    client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
    refresh_token: refreshToken ?? "",
  }).toString();
}

/**
 * Resolve a usable HubSpot bearer token for a tenant, or null.
 *
 * - OAuth mode: returns the cached access token while it is still valid (with a
 *   120s safety margin); otherwise refreshes via the token endpoint, persists
 *   the new encrypted access token (+ refresh token if rotated) and expiry, and
 *   returns the fresh token. Never throws on refresh failure — returns null.
 * - PAT mode (or unset): returns the decrypted private-app token.
 */
export async function getHubspotAccessToken(prisma, tenantId, { fetchImpl = fetch } = {}) {
  const row = await getMofuIntegration(prisma, tenantId);
  if (!row) return null;

  if (row.connectionMode === "oauth") {
    const expiresAt = row.hubspotTokenExpiresAt
      ? new Date(row.hubspotTokenExpiresAt).getTime()
      : 0;
    const stillValid = expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now();

    if (stillValid && row.encryptedHubspotAccessToken) {
      try {
        return decryptMofuToken(row.encryptedHubspotAccessToken);
      } catch (err) {
        console.warn("[MOFU] failed to decrypt cached HubSpot access token:", err.message);
        // fall through to refresh
      }
    }

    if (!row.encryptedHubspotRefreshToken) {
      console.warn("[MOFU] HubSpot OAuth token expired and no refresh token is stored");
      return null;
    }

    try {
      const refreshToken = decryptMofuToken(row.encryptedHubspotRefreshToken);
      const res = await fetchImpl(HUBSPOT_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: buildTokenRefreshBody({ refreshToken }),
      });
      if (!res.ok) {
        console.warn("[MOFU] HubSpot token refresh failed with status", res.status);
        return null;
      }
      const data = await res.json();
      const accessToken = data.access_token;
      if (!accessToken) {
        console.warn("[MOFU] HubSpot token refresh returned no access_token");
        return null;
      }
      const update = {
        encryptedHubspotAccessToken: encryptMofuToken(accessToken),
        hubspotTokenExpiresAt: new Date(Date.now() + (data.expires_in ?? 0) * 1000),
      };
      if (data.refresh_token) {
        update.encryptedHubspotRefreshToken = encryptMofuToken(data.refresh_token);
      }
      await prisma.mofuIntegration.update({ where: { tenantId }, data: update });
      return accessToken;
    } catch (err) {
      console.warn("[MOFU] HubSpot token refresh error:", err.message);
      return null;
    }
  }

  // PAT mode (or unset connectionMode): legacy private-app token.
  if (!row.encryptedHubspotToken) return null;
  try {
    return decryptMofuToken(row.encryptedHubspotToken);
  } catch (err) {
    console.warn("[MOFU] failed to decrypt HubSpot PAT:", err.message);
    return null;
  }
}

/**
 * Server-side only: resolve the HubSpot bearer token for outbound calls.
 * Delegates to {@link getHubspotAccessToken} so OAuth-connected tenants are
 * served transparently while PAT tenants keep working. Null if unconfigured.
 */
export async function getDecryptedHubspotToken(prisma, tenantId, opts) {
  return getHubspotAccessToken(prisma, tenantId, opts);
}

/**
 * Persist a HubSpot OAuth grant for a tenant (called from the callback route
 * after a successful code exchange). Stores encrypted access + refresh tokens,
 * flips connectionMode to oauth, and marks the integration connected.
 */
export async function upsertHubspotOAuth(
  prisma,
  tenantId,
  { accessToken, refreshToken, expiresIn, portalId, scopes } = {}
) {
  const data = {
    connectionMode: "oauth",
    encryptedHubspotAccessToken: encryptMofuToken(accessToken),
    encryptedHubspotRefreshToken: refreshToken ? encryptMofuToken(refreshToken) : null,
    hubspotTokenExpiresAt: new Date(Date.now() + (expiresIn ?? 0) * 1000),
    hubspotScopes: Array.isArray(scopes) ? scopes : [],
    hubspotPortalId: portalId ? String(portalId) : null,
    status: "connected",
    connectedAt: new Date(),
  };
  return prisma.mofuIntegration.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

/** Safe-for-client view: masks/omits the token, exposes config + status only. */
export function toDisplayConfig(row) {
  if (!row) return { configured: false };
  let hubspotTokenMasked = null;
  if (row.encryptedHubspotToken) {
    try {
      hubspotTokenMasked = maskToken(decryptMofuToken(row.encryptedHubspotToken));
    } catch {
      hubspotTokenMasked = null;
    }
  }
  return {
    configured: true,
    connectionMode: row.connectionMode ?? "pat",
    hubspotPortalId: row.hubspotPortalId ?? null,
    defaultOwnerId: row.defaultOwnerId ?? null,
    insightModel: row.insightModel ?? null,
    status: row.status ?? "pending",
    connectedAt: row.connectedAt ?? null,
    scopeCount: Array.isArray(row.hubspotScopes) ? row.hubspotScopes.length : 0,
    hubspotTokenMasked,
  };
}

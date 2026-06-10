import { encryptMofuToken, decryptMofuToken } from "@/lib/encryptSecret";
import { assessRecordingScopes } from "@/lib/assist/hubspotScopes";

/**
 * MOFU integration credential store. One row per tenant (`MofuIntegration`).
 *
 * Each tenant connects HubSpot via OAuth ("Connect HubSpot" in Integrations). We
 * persist an encrypted access token + refresh token and auto-refresh on expiry.
 *
 * All credentials are stored AES-256-GCM encrypted and never leave the server
 * in plaintext.
 */

const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
// Refresh slightly before the real expiry so in-flight calls never use a dead token.
const TOKEN_EXPIRY_MARGIN_MS = 120 * 1000;

/** True when the tenant has an OAuth grant stored (access and/or refresh token). */
export function isHubspotOAuthConnected(row) {
  if (!row || row.connectionMode !== "oauth") return false;
  return !!(row.encryptedHubspotRefreshToken || row.encryptedHubspotAccessToken);
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
 * Returns the cached access token while it is still valid (with a 120s safety
 * margin); otherwise refreshes via the token endpoint, persists the new
 * encrypted access token (+ refresh token if rotated) and expiry, and returns
 * the fresh token. Never throws on refresh failure — returns null.
 */
export async function getHubspotAccessToken(prisma, tenantId, { fetchImpl = fetch } = {}) {
  const row = await getMofuIntegration(prisma, tenantId);
  if (!row || row.connectionMode !== "oauth") return null;

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

/** Server-side only: resolve the HubSpot bearer token for outbound calls. */
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

/** Safe-for-client view: exposes config + status only (no tokens). */
export function toDisplayConfig(row) {
  if (!row) return { configured: false };
  const connected = isHubspotOAuthConnected(row);
  const singleSendEmailId = row.hubspotSingleSendEmailId ?? null;
  const hubspotScopes = Array.isArray(row.hubspotScopes) ? row.hubspotScopes : [];
  const recordingScopes = assessRecordingScopes(hubspotScopes);
  return {
    configured: connected,
    connectionMode: connected ? "oauth" : null,
    hubspotPortalId: row.hubspotPortalId ?? null,
    defaultOwnerId: row.defaultOwnerId ?? null,
    insightModel: row.insightModel ?? null,
    status: row.status ?? "pending",
    connectedAt: row.connectedAt ?? null,
    hubspotScopes,
    scopeCount: hubspotScopes.length,
    singleSendEmailId,
    canDeliverEmail: !!singleSendEmailId,
    canFetchCallTranscripts: recordingScopes.hasTranscriptsRead,
    recordingScopes,
  };
}

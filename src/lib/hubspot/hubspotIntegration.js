import { prisma as defaultPrisma } from "@/lib/prisma";
import { encryptHubSpotToken, decryptHubSpotToken } from "@/lib/encryptSecret";

const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

export async function getHubSpotIntegration(tenantId, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  return prisma.hubSpotIntegration.findUnique({ where: { tenantId } });
}

export function isHubSpotConnected(integration) {
  return (
    !!integration &&
    integration.status === "connected" &&
    !!integration.encryptedAccessToken
  );
}

/**
 * Phase A auth path: store a Private App token (static — no refresh, no expiry).
 * The adapter only ever reads decryptHubSpotToken(encryptedAccessToken), so the
 * deferred OAuth path below is a drop-in replacement with zero downstream changes.
 */
export async function connectHubSpotFromPat(tenantId, pat, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  if (!pat || !pat.trim()) throw new Error("hubspot_pat_required");
  const data = {
    tenantId,
    portalId: deps.portalId ?? null,
    encryptedAccessToken: encryptHubSpotToken(pat.trim()),
    encryptedRefreshToken: null,
    tokenExpiresAt: null,
    scopes: (process.env.HUBSPOT_SCOPES || "").split(/\s+/).filter(Boolean),
    status: "connected",
    lastError: null,
    connectedAt: new Date(),
  };
  return prisma.hubSpotIntegration.upsert({
    where: { tenantId },
    create: data,
    update: data,
  });
}

/**
 * DEFERRED (multi-tenant productionization): OAuth authorization-code exchange.
 * Not exercised in Phase A — kept here so switching from PAT to OAuth later is a
 * config/route change only. See plan §"Task 2".
 */
export async function connectHubSpotFromOAuth(tenantId, code, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.HUBSPOT_CLIENT_ID,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`hubspot_token_exchange_failed_${res.status}`);
  const tok = await res.json(); // { access_token, refresh_token, expires_in }
  const data = {
    tenantId,
    encryptedAccessToken: encryptHubSpotToken(tok.access_token),
    encryptedRefreshToken: encryptHubSpotToken(tok.refresh_token),
    tokenExpiresAt: new Date(Date.now() + (tok.expires_in ?? 1800) * 1000),
    scopes: (process.env.HUBSPOT_SCOPES || "").split(/\s+/).filter(Boolean),
    status: "connected",
    lastError: null,
    connectedAt: new Date(),
  };
  return prisma.hubSpotIntegration.upsert({
    where: { tenantId },
    create: data,
    update: data,
  });
}

export { decryptHubSpotToken };

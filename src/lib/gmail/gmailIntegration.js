/**
 * Per-user Gmail OAuth connection store (one Gmail per user per tenant).
 */
import { encryptGmailToken, decryptGmailToken } from "@/lib/encryptSecret";
import {
  exchangeGmailCode,
  fetchGmailUserEmail,
  refreshGmailAccessToken,
  tokenStillValid,
} from "@/lib/gmail/gmailOAuth";

export async function getUserGmailConnection(prisma, tenantId, userId) {
  if (!tenantId || !userId) return null;
  return prisma.userGmailConnection.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
}

export function toGmailDisplayConfig(row) {
  if (!row || row.status !== "connected") {
    return { connected: false };
  }
  return {
    connected: true,
    email: row.email,
    connectedAt: row.connectedAt ?? null,
  };
}

export async function upsertGmailOAuth(prisma, { tenantId, userId, accessToken, refreshToken, expiresIn }) {
  const email = await fetchGmailUserEmail(accessToken);
  if (!email) {
    throw new Error("Could not resolve Gmail account email");
  }
  const data = {
    email,
    encryptedAccessToken: encryptGmailToken(accessToken),
    encryptedRefreshToken: refreshToken ? encryptGmailToken(refreshToken) : null,
    tokenExpiresAt: new Date(Date.now() + (expiresIn ?? 3600) * 1000),
    status: "connected",
    connectedAt: new Date(),
  };
  return prisma.userGmailConnection.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: { tenantId, userId, ...data },
    update: data,
  });
}

/** Resolve a usable Gmail access token for a user, refreshing if needed. */
export async function getGmailAccessToken(prisma, tenantId, userId, { fetchImpl = fetch } = {}) {
  const row = await getUserGmailConnection(prisma, tenantId, userId);
  if (!row || row.status !== "connected") return null;

  if (tokenStillValid(row.tokenExpiresAt)) {
    try {
      return { accessToken: decryptGmailToken(row.encryptedAccessToken), email: row.email };
    } catch {
      // fall through to refresh
    }
  }

  if (!row.encryptedRefreshToken) return null;

  try {
    const refreshToken = decryptGmailToken(row.encryptedRefreshToken);
    const refreshed = await refreshGmailAccessToken(refreshToken, { fetchImpl });
    if (!refreshed.ok || !refreshed.access_token) {
      console.warn(`[Gmail] token refresh failed user=${userId} status=${refreshed.status}`);
      return null;
    }
    const update = {
      encryptedAccessToken: encryptGmailToken(refreshed.access_token),
      tokenExpiresAt: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000),
    };
    if (refreshed.refresh_token) {
      update.encryptedRefreshToken = encryptGmailToken(refreshed.refresh_token);
    }
    await prisma.userGmailConnection.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: update,
    });
    return { accessToken: refreshed.access_token, email: row.email };
  } catch (err) {
    console.warn(`[Gmail] token refresh error user=${userId}: ${err.message}`);
    return null;
  }
}

export async function disconnectGmail(prisma, tenantId, userId) {
  await prisma.userGmailConnection.deleteMany({ where: { tenantId, userId } });
}

export { exchangeGmailCode };

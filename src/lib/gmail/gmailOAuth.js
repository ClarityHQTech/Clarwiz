/**
 * Google Gmail OAuth helpers (authorization URL, token exchange, refresh).
 */

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
];

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const TOKEN_EXPIRY_MARGIN_MS = 120 * 1000;

export function buildGmailAuthorizeUrl(state) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("Gmail OAuth is not configured");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function buildTokenExchangeBody({ code }) {
  return new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.GMAIL_CLIENT_ID ?? "",
    client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
    redirect_uri: process.env.GMAIL_REDIRECT_URI ?? "",
    code: code ?? "",
  }).toString();
}

export function buildTokenRefreshBody({ refreshToken }) {
  return new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.GMAIL_CLIENT_ID ?? "",
    client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
    refresh_token: refreshToken ?? "",
  }).toString();
}

/** Exchange auth code for tokens. Never throws — returns { ok, ... }. */
export async function exchangeGmailCode(code, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildTokenExchangeBody({ code }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.access_token) {
      return { ok: false, status: res.status, json };
    }
    return { ok: true, ...json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Refresh an access token. Never throws. */
export async function refreshGmailAccessToken(refreshToken, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildTokenRefreshBody({ refreshToken }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.access_token) {
      return { ok: false, status: res.status, json };
    }
    return { ok: true, ...json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Fetch the connected Google account email. */
export async function fetchGmailUserEmail(accessToken, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return null;
    return json?.email ? String(json.email).trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export function tokenStillValid(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - TOKEN_EXPIRY_MARGIN_MS > Date.now();
}

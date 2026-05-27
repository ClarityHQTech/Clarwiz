import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppBaseUrl } from "@/lib/appUrl";

const CALENDLY_AUTH_BASE = "https://auth.calendly.com";
const CALENDLY_API_BASE = "https://api.calendly.com";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getCalendlyRedirectUri() {
  return (
    process.env.CALENDLY_REDIRECT_URI?.trim() ||
    `${getAppBaseUrl()}/api/integrations/calendly/oauth/callback`
  );
}

/** Scopes required for /users/me, webhooks, and invitee event payloads. */
export const CALENDLY_OAUTH_SCOPES = [
  "users:read",
  "scheduled_events:read",
  "webhooks:write",
].join(" ");

export function buildCalendlyAuthorizeUrl(state) {
  const clientId = requireEnv("CALENDLY_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getCalendlyRedirectUri(),
    state,
    scope: CALENDLY_OAUTH_SCOPES,
  });
  return `${CALENDLY_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

/** Calendly canonical URI string from API fields (string or { uri }). */
export function normalizeCalendlyUri(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.uri === "string") return value.uri;
  return null;
}

/**
 * Webhook callback URL — must be public HTTPS (not localhost).
 * Override with CALENDLY_WEBHOOK_URL for ngrok / production.
 */
export function getCalendlyWebhookCallbackUrl() {
  return (
    process.env.CALENDLY_WEBHOOK_URL?.trim() ||
    `${getAppBaseUrl()}/api/webhooks/calendly`
  );
}

export function assertCalendlyWebhookCallbackUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Calendly webhook URL: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(
      "Calendly webhooks require a public HTTPS callback URL. " +
        "Set CALENDLY_WEBHOOK_URL in .env to your ngrok or deployed URL, e.g. " +
        "https://your-subdomain.ngrok-free.app/api/webhooks/calendly"
    );
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    throw new Error(
      "Calendly cannot deliver webhooks to localhost. " +
        "Expose your app with ngrok (or deploy) and set CALENDLY_WEBHOOK_URL."
    );
  }
}

export async function exchangeCalendlyCode(code) {
  const clientId = requireEnv("CALENDLY_CLIENT_ID");
  const clientSecret = requireEnv("CALENDLY_CLIENT_SECRET");
  const res = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getCalendlyRedirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Calendly token exchange failed");
  }
  return data;
}

export async function refreshCalendlyToken(refreshToken) {
  const clientId = requireEnv("CALENDLY_CLIENT_ID");
  const clientSecret = requireEnv("CALENDLY_CLIENT_SECRET");
  const res = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Calendly token refresh failed");
  }
  return data;
}

async function calendlyFetch(path, accessToken, options = {}) {
  const res = await fetch(`${CALENDLY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detailText = Array.isArray(data.details)
      ? data.details
          .map((d) => d.message || `${d.parameter}: ${d.code}`)
          .filter(Boolean)
          .join("; ")
      : "";
    throw new Error(
      detailText ||
        data.message ||
        data.title ||
        `Calendly API ${path} failed (${res.status})`
    );
  }
  return data;
}

export async function getCalendlyCurrentUser(accessToken) {
  return calendlyFetch("/users/me", accessToken);
}

export async function createCalendlyWebhookSubscription(accessToken, { organizationUri, userUri }) {
  const url = getCalendlyWebhookCallbackUrl();
  assertCalendlyWebhookCallbackUrl(url);

  const organization = normalizeCalendlyUri(organizationUri);
  const user = normalizeCalendlyUri(userUri);
  const events = ["invitee.created", "invitee.canceled"];

  if (!organization && !user) {
    throw new Error("organizationUri or userUri required for webhook subscription");
  }

  async function postSubscription(body) {
    const data = await calendlyFetch("/webhook_subscriptions", accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data.resource;
  }

  // User scope requires both organization + user URIs (Calendly FAQ).
  if (organization && user) {
    try {
      return await postSubscription({
        url,
        events,
        scope: "user",
        organization,
        user,
      });
    } catch (err) {
      console.warn("[calendly] user-scoped webhook failed, trying organization:", err.message);
    }
  }

  if (organization) {
    return await postSubscription({
      url,
      events,
      scope: "organization",
      organization,
    });
  }

  throw new Error("Could not create webhook: missing organization URI from /users/me");
}

export async function deleteCalendlyWebhookSubscription(accessToken, subscriptionUri) {
  const uuid = subscriptionUri.split("/").pop();
  if (!uuid) return;
  await calendlyFetch(`/webhook_subscriptions/${uuid}`, accessToken, {
    method: "DELETE",
  });
}

/**
 * Verify Calendly-Webhook-Signature header (t=timestamp,v1=hex).
 * @see https://developer.calendly.com/api-docs
 */
export function verifyCalendlyWebhookSignature(rawBody, signatureHeader, signingKey) {
  if (!signatureHeader || !signingKey) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.trim().split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", signingKey)
    .update(payload, "utf8")
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

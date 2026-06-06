// Low-level HubSpot REST client. Pure + injectable (fetchImpl/sleep) so retry
// behavior is unit-testable. Token handling lives in hubspotIntegration.js.

const BASE = "https://api.hubapi.com";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Perform a HubSpot REST call with exponential backoff on 429/5xx (max 3 attempts).
 * Throws a structured error ({ code, status }) on terminal failure — callers in the
 * SorAdapter translate that into a not-connected/stale-context no-op, never a crash.
 */
export async function hubspotFetch(
  path,
  {
    accessToken,
    method = "GET",
    body,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    maxAttempts = 3,
  } = {}
) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchImpl(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.json();
    lastStatus = res.status;
    if (!RETRYABLE.has(res.status) || attempt === maxAttempts) break;
    await sleep(200 * 2 ** (attempt - 1)); // 200ms, 400ms
  }
  const err = new Error(`hubspot_request_failed_${lastStatus}`);
  err.code =
    lastStatus === 429
      ? "hubspot_rate_limited"
      : lastStatus === 401 || lastStatus === 403
        ? "hubspot_unauthorized"
        : "hubspot_unavailable";
  err.status = lastStatus;
  throw err;
}

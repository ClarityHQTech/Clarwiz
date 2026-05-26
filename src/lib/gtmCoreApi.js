import { Agent, fetch as undiciFetch } from "undici";

const DEFAULT_BASE_URL = "https://gtm-core.vercel.app/api/tools";

const TOOLS = [
  "icp_gap_analysis",
  "market_research",
  "value_proposition",
  "icp",
  "account_signal_extractor",
];

const CONTEXT_CHAR_LIMITS = {
  relevant_data: 20_000,
  icp_gap_analysis: 12_000,
  market_research: 15_000,
  value_proposition: 12_000,
  account_data: 20_000,
  icp: 15_000,
};

function getTimeoutMs() {
  const n = Number(process.env.GTM_CORE_API_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 600_000;
}

function getRetryAttempts() {
  const n = Number(process.env.GTM_CORE_RETRY_ATTEMPTS);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 5) : 2;
}

function getBaseUrl() {
  return (process.env.GTM_CORE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function getApiKey() {
  const key = process.env.GTM_CORE_API_KEY?.trim();
  if (!key) {
    throw new Error("GTM_CORE_API_KEY is not configured");
  }
  return key;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shrink prior-step outputs so downstream tools finish within GTM Core's ~5 min Vercel limit */
export function truncateGtmContextField(fieldName, text) {
  if (!text || typeof text !== "string") return text;
  const max = CONTEXT_CHAR_LIMITS[fieldName] ?? 12_000;
  const t = text.trim();
  if (t.length <= max) return t;
  return `[Truncated ${fieldName}: ${t.length} → ${max} chars for API limits]\n\n${t.slice(0, max)}`;
}

function createAgent(timeoutMs) {
  return new Agent({
    connectTimeout: 60_000,
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    keepAliveTimeout: 1_000,
    keepAliveMaxTimeout: 4_000,
  });
}

function isTransientFetchError(err) {
  const cause = `${err.cause?.message || ""} ${err.cause?.code || ""}`.toLowerCase();
  const msg = `${err.message || ""}`.toLowerCase();
  return (
    err.code === "UPSTREAM_FAILED" ||
    err.code === "TIMEOUT" ||
    msg === "fetch failed" ||
    msg.includes("other side closed") ||
    msg.includes("socket") ||
    cause.includes("other side closed") ||
    cause.includes("econnreset") ||
    cause.includes("socket") ||
    err.code === "UND_ERR_SOCKET" ||
    err.code === "UND_ERR_HEADERS_TIMEOUT" ||
    err.code === "UND_ERR_BODY_TIMEOUT"
  );
}

function wrapFetchError(tool, err, timeoutMs) {
  if (err.code === "UPSTREAM_FAILED" || err.code === "TIMEOUT") {
    return err;
  }

  if (err.name === "AbortError") {
    const e = new Error(
      `GTM Core ${tool} timed out after ${Math.round(timeoutMs / 1000)}s`
    );
    e.code = "TIMEOUT";
    e.retryable = true;
    return e;
  }

  const cause = err.cause?.message || err.cause?.code || "";
  const detail = cause ? `: ${cause}` : "";

  if (
    err.message === "fetch failed" ||
    `${err.message} ${cause}`.toLowerCase().includes("other side closed") ||
    err.code === "UND_ERR_HEADERS_TIMEOUT" ||
    err.code === "UND_ERR_BODY_TIMEOUT" ||
    err.code === "UND_ERR_SOCKET"
  ) {
    const e = new Error(
      `GTM Core ${tool} connection closed${detail}. The upstream server likely hit its time limit (~5 min on Vercel). Retrying automatically, or click Run again to resume this step.`
    );
    e.code = "UPSTREAM_FAILED";
    e.retryable = true;
    return e;
  }

  return err;
}

async function callGtmCoreToolOnce(tool, body) {
  const url = `${getBaseUrl()}/${tool}`;
  const timeoutMs = getTimeoutMs();
  const agent = createAgent(timeoutMs);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await undiciFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
        Connection: "close",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      dispatcher: agent,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        data.error ||
        data.message ||
        `GTM Core ${tool} failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.details = data.details;
      err.retryable = res.status >= 502 || res.status === 429;
      throw err;
    }

    if (data.success === false) {
      const err = new Error(data.error || `GTM Core ${tool} returned success=false`);
      err.details = data.details;
      err.retryable = false;
      throw err;
    }

    return data;
  } catch (err) {
    throw wrapFetchError(tool, err, timeoutMs);
  } finally {
    clearTimeout(timer);
    await agent.close().catch(() => {});
  }
}

/**
 * @param {string} tool - one of TOOLS
 * @param {Record<string, string>} body
 */
export async function callGtmCoreTool(tool, body) {
  if (!TOOLS.includes(tool)) {
    throw new Error(`Unknown GTM Core tool: ${tool}`);
  }

  const maxAttempts = 1 + getRetryAttempts();
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callGtmCoreToolOnce(tool, body);
    } catch (err) {
      lastErr = err;
      const canRetry =
        attempt < maxAttempts && (err.retryable || isTransientFetchError(err));

      if (!canRetry) {
        throw err;
      }

      await sleep(Math.min(15_000, 4_000 * attempt));
    }
  }

  throw lastErr;
}

export function buildBasePayload({ companyName, companyDomain, relevantData, userQuery }) {
  const payload = {
    company_name: companyName?.trim(),
    company_domain: companyDomain?.trim(),
    relevant_data: truncateGtmContextField("relevant_data", relevantData?.trim()),
  };
  if (userQuery?.trim()) {
    payload.user_query = userQuery.trim();
  }
  return payload;
}

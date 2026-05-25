const LINKUP_BASE = "https://api.linkupapi.com/v2";

function getApiKey() {
  const key = process.env.LINKUP_API_KEY;
  if (!key) {
    throw new Error("LINKUP_API_KEY is not configured");
  }
  return key;
}

async function linkupRequest(path, body) {
  const res = await fetch(`${LINKUP_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok && data?.success !== false) {
    return {
      success: false,
      error: {
        code: "HTTP_ERROR",
        message: data?.error?.message || `LinkupAPI request failed (${res.status})`,
      },
      metadata: data?.metadata,
    };
  }

  return data;
}

export async function linkupLogin({ email, password, country = "US", accountName }) {
  return linkupRequest("/login", {
    platform: "linkedin",
    email,
    password,
    country,
    account_name: accountName,
  });
}

export async function linkupCheckpoint({ accountId, code }) {
  const body = { account_id: accountId };
  if (code) body.code = code;
  return linkupRequest("/checkpoint", body);
}

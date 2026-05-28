import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 15 * 60 * 1000;

function signingKey() {
  const secret = process.env.SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("SECRET is not configured");
  return secret;
}

/** Signed OAuth state: base64url(payload).base64url(hmac) */
export function createOAuthState(tenantId, provider = "calendly", extra = {}) {
  const payload = JSON.stringify({
    tenantId,
    provider,
    ts: Date.now(),
    nonce: randomBytes(8).toString("hex"),
    ...extra,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", signingKey())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyOAuthState(state, expectedProvider = "calendly") {
  if (!state?.includes(".")) return null;
  const [payloadB64, sig] = state.split(".");
  const expectedSig = createHmac("sha256", signingKey())
    .update(payloadB64)
    .digest("base64url");
  try {
    if (
      !timingSafeEqual(
        Buffer.from(sig, "base64url"),
        Buffer.from(expectedSig, "base64url")
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.provider !== expectedProvider) return null;
  if (Date.now() - payload.ts > MAX_AGE_MS) return null;
  return payload;
}

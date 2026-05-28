import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ExternalErrorCodes, error } from "@/lib/externalApi";

const KEY_PREFIX = "cw_key_";
const RAW_KEY_BYTES = 24;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateExternalApiKey() {
  const randomPart = crypto.randomBytes(RAW_KEY_BYTES).toString("hex");
  const rawKey = `${KEY_PREFIX}${randomPart}`;
  return {
    rawKey,
    prefix: rawKey.slice(0, 14),
    keyHash: sha256(rawKey),
  };
}

export async function authenticateApiKeyRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return {
      error: error(
        request,
        401,
        ExternalErrorCodes.UNAUTHORIZED,
        "Missing API key. Use Authorization: Bearer <api_key>."
      ),
    };
  }

  const keyHash = sha256(token);
  const apiKey = await prisma.externalApiKey.findUnique({
    where: { keyHash },
    include: {
      tenant: {
        select: { id: true, name: true, payment_status: true },
      },
    },
  });

  if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt <= new Date())) {
    return {
      error: error(request, 401, ExternalErrorCodes.UNAUTHORIZED, "Invalid or expired API key."),
    };
  }

  await prisma.externalApiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    auth: {
      keyId: apiKey.id,
      tenantId: apiKey.tenantId,
      tenant: apiKey.tenant,
      scopes: apiKey.scopes || [],
    },
  };
}

export function ensureTenantAccess(request, auth, tenantId) {
  if (auth.tenantId !== tenantId) {
    return {
      error: error(
        request,
        403,
        ExternalErrorCodes.FORBIDDEN,
        "API key is not allowed to access this tenant."
      ),
    };
  }
  return { ok: true };
}

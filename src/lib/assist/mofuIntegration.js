import { encryptMofuToken, decryptMofuToken } from "@/lib/encryptSecret";

/**
 * MOFU integration credential store. One row per tenant (`MofuIntegration`).
 * The HubSpot private-app token is stored AES-256-GCM encrypted and never
 * leaves the server in plaintext — display paths mask it to the last 4 chars.
 */

/** Mask a secret for display: `••••WXYZ`. Returns null for empty input. */
export function maskToken(token) {
  if (!token) return null;
  return `••••${String(token).slice(-4)}`;
}

/**
 * Shape the persisted columns from raw form input, encrypting the token.
 * Pure (no DB) so it is unit-testable. Throws if the token is missing.
 */
export function buildMofuIntegrationData({
  hubspotToken,
  hubspotPortalId = null,
  defaultOwnerId = null,
  insightModel = null,
} = {}) {
  if (!hubspotToken) {
    throw new Error("hubspotToken is required");
  }
  return {
    encryptedHubspotToken: encryptMofuToken(hubspotToken),
    hubspotPortalId: hubspotPortalId || null,
    defaultOwnerId: defaultOwnerId || null,
    insightModel: insightModel || null,
  };
}

/** Upsert a tenant's MOFU integration (status lifecycle is owned by the route after verification). */
export async function upsertMofuIntegration(prisma, tenantId, input) {
  const data = buildMofuIntegrationData(input);
  return prisma.mofuIntegration.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

export async function getMofuIntegration(prisma, tenantId) {
  return prisma.mofuIntegration.findUnique({ where: { tenantId } });
}

/** Server-side only: decrypt the stored HubSpot token for outbound calls. Null if unconfigured. */
export async function getDecryptedHubspotToken(prisma, tenantId) {
  const row = await getMofuIntegration(prisma, tenantId);
  if (!row?.encryptedHubspotToken) return null;
  return decryptMofuToken(row.encryptedHubspotToken);
}

/** Safe-for-client view: masks the token, exposes config + status only. */
export function toDisplayConfig(row) {
  if (!row) return { configured: false };
  return {
    configured: true,
    hubspotPortalId: row.hubspotPortalId ?? null,
    defaultOwnerId: row.defaultOwnerId ?? null,
    insightModel: row.insightModel ?? null,
    status: row.status ?? "pending",
    connectedAt: row.connectedAt ?? null,
    hubspotTokenMasked: maskToken(decryptMofuToken(row.encryptedHubspotToken)),
  };
}

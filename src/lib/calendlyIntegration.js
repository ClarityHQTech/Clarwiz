import { prisma } from "@/lib/prisma";
import {
  decryptCalendlyToken,
  encryptCalendlyToken,
} from "@/lib/encryptSecret";
import {
  CALENDLY_CONNECTION_MODES,
  createCalendlyWebhookSubscription,
  deleteCalendlyWebhookSubscription,
  exchangeCalendlyCode,
  getCalendlyCurrentUser,
  normalizeCalendlyConnectionMode,
  normalizeCalendlyUri,
  refreshCalendlyToken,
} from "@/lib/calendlyApi";

export function serializeCalendlyIntegration(record) {
  if (!record) return null;
  const uris = Array.isArray(record.webhookSubscriptionUris)
    ? record.webhookSubscriptionUris
    : [];
  const connectionMode = normalizeCalendlyConnectionMode(record.connectionMode);
  return {
    status: record.status,
    connectionMode,
    ownerEmail: record.ownerEmail,
    organizationUri: record.organizationUri,
    userUri: record.userUri,
    connectedAt: record.connectedAt?.toISOString?.() ?? null,
    webhooksActive:
      record.status === "connected" &&
      connectionMode === CALENDLY_CONNECTION_MODES.WEBHOOKS &&
      uris.length > 0,
    webhookCount: uris.length,
  };
}

export async function getCalendlyIntegration(tenantId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { tenantId },
  });
  return serializeCalendlyIntegration(record);
}

export async function getCalendlyAccessToken(tenantId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { tenantId },
  });
  if (!record || record.status !== "connected") return null;
  return decryptCalendlyToken(record.encryptedAccessToken);
}

async function deleteExistingWebhooks(accessToken, uris, connectionMode) {
  if (normalizeCalendlyConnectionMode(connectionMode) !== CALENDLY_CONNECTION_MODES.WEBHOOKS) {
    return;
  }
  for (const uri of uris ?? []) {
    try {
      await deleteCalendlyWebhookSubscription(accessToken, uri);
    } catch (err) {
      console.warn("[calendly] delete webhook failed:", uri, err.message);
    }
  }
}

export async function connectCalendlyFromOAuth(tenantId, code, connectionMode) {
  const mode = normalizeCalendlyConnectionMode(connectionMode);
  const tokenData = await exchangeCalendlyCode(code, mode);
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token ?? null;

  const me = await getCalendlyCurrentUser(accessToken);
  const resource = me.resource ?? me;
  const organizationUri = normalizeCalendlyUri(resource.current_organization);
  const userUri = normalizeCalendlyUri(resource.uri);
  const ownerEmail = resource.email ?? null;

  const existing = await prisma.calendlyIntegration.findUnique({
    where: { tenantId },
  });
  if (existing?.webhookSubscriptionUris) {
    const oldToken = existing.encryptedAccessToken
      ? decryptCalendlyToken(existing.encryptedAccessToken)
      : accessToken;
    const oldMode = normalizeCalendlyConnectionMode(existing.connectionMode);
    await deleteExistingWebhooks(
      oldToken,
      Array.isArray(existing.webhookSubscriptionUris)
        ? existing.webhookSubscriptionUris
        : [],
      oldMode
    );
  }

  let webhookSubscriptionUris = [];
  if (mode === CALENDLY_CONNECTION_MODES.WEBHOOKS) {
    const subscription = await createCalendlyWebhookSubscription(accessToken, {
      organizationUri,
      userUri,
    });
    webhookSubscriptionUris = [subscription.uri];
  }

  const record = await prisma.calendlyIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      encryptedAccessToken: encryptCalendlyToken(accessToken),
      encryptedRefreshToken: refreshToken
        ? encryptCalendlyToken(refreshToken)
        : null,
      organizationUri,
      userUri,
      ownerEmail,
      connectionMode: mode,
      status: "connected",
      webhookSubscriptionUris,
      connectedAt: new Date(),
    },
    update: {
      encryptedAccessToken: encryptCalendlyToken(accessToken),
      encryptedRefreshToken: refreshToken
        ? encryptCalendlyToken(refreshToken)
        : undefined,
      organizationUri,
      userUri,
      ownerEmail,
      connectionMode: mode,
      status: "connected",
      webhookSubscriptionUris,
      connectedAt: new Date(),
    },
  });

  return serializeCalendlyIntegration(record);
}

export async function disconnectCalendly(tenantId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { tenantId },
  });
  if (!record) return null;

  try {
    const accessToken = decryptCalendlyToken(record.encryptedAccessToken);
    const uris = Array.isArray(record.webhookSubscriptionUris)
      ? record.webhookSubscriptionUris
      : [];
    await deleteExistingWebhooks(
      accessToken,
      uris,
      normalizeCalendlyConnectionMode(record.connectionMode)
    );
  } catch (err) {
    console.warn("[calendly] disconnect cleanup:", err.message);
  }

  await prisma.calendlyIntegration.delete({ where: { tenantId } });
  return { disconnected: true };
}

export async function findCalendlyIntegrationByOrganizationUri(organizationUri) {
  if (!organizationUri) return null;
  return prisma.calendlyIntegration.findFirst({
    where: {
      organizationUri,
      status: "connected",
      connectionMode: CALENDLY_CONNECTION_MODES.WEBHOOKS,
    },
  });
}

export async function findCalendlyIntegrationByUserUri(userUri) {
  if (!userUri) return null;
  return prisma.calendlyIntegration.findFirst({
    where: {
      userUri,
      status: "connected",
      connectionMode: CALENDLY_CONNECTION_MODES.WEBHOOKS,
    },
  });
}

export async function ensureCalendlyAccessToken(tenantId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { tenantId },
  });
  if (!record?.encryptedAccessToken) return null;

  try {
    return decryptCalendlyToken(record.encryptedAccessToken);
  } catch {
    if (!record.encryptedRefreshToken) throw new Error("Calendly token invalid");
    const refresh = decryptCalendlyToken(record.encryptedRefreshToken);
    const tokenData = await refreshCalendlyToken(
      refresh,
      normalizeCalendlyConnectionMode(record.connectionMode)
    );
    const accessToken = tokenData.access_token;
    await prisma.calendlyIntegration.update({
      where: { tenantId },
      data: {
        encryptedAccessToken: encryptCalendlyToken(accessToken),
        encryptedRefreshToken: tokenData.refresh_token
          ? encryptCalendlyToken(tokenData.refresh_token)
          : record.encryptedRefreshToken,
      },
    });
    return accessToken;
  }
}

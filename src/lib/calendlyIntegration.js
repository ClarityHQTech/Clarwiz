import { prisma } from "@/lib/prisma";
import {
  decryptCalendlyToken,
  encryptCalendlyToken,
} from "@/lib/encryptSecret";
import {
  createCalendlyWebhookSubscription,
  deleteCalendlyWebhookSubscription,
  exchangeCalendlyCode,
  getCalendlyCurrentUser,
  normalizeCalendlyUri,
  refreshCalendlyToken,
} from "@/lib/calendlyApi";

export function serializeCalendlyIntegration(record) {
  if (!record) return null;
  const uris = Array.isArray(record.webhookSubscriptionUris)
    ? record.webhookSubscriptionUris
    : [];
  return {
    status: record.status,
    ownerEmail: record.ownerEmail,
    organizationUri: record.organizationUri,
    userUri: record.userUri,
    connectedAt: record.connectedAt?.toISOString?.() ?? null,
    webhooksActive: record.status === "connected" && uris.length > 0,
    webhookCount: uris.length,
  };
}

export async function getCalendlyIntegration(userId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { userId },
  });
  return serializeCalendlyIntegration(record);
}

export async function getCalendlyAccessToken(userId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { userId },
  });
  if (!record || record.status !== "connected") return null;
  return decryptCalendlyToken(record.encryptedAccessToken);
}

async function deleteExistingWebhooks(accessToken, uris) {
  for (const uri of uris ?? []) {
    try {
      await deleteCalendlyWebhookSubscription(accessToken, uri);
    } catch (err) {
      console.warn("[calendly] delete webhook failed:", uri, err.message);
    }
  }
}

export async function connectCalendlyFromOAuth(userId, code) {
  const tokenData = await exchangeCalendlyCode(code);
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token ?? null;

  const me = await getCalendlyCurrentUser(accessToken);
  const resource = me.resource ?? me;
  const organizationUri = normalizeCalendlyUri(resource.current_organization);
  const userUri = normalizeCalendlyUri(resource.uri);
  const ownerEmail = resource.email ?? null;

  const existing = await prisma.calendlyIntegration.findUnique({
    where: { userId },
  });
  if (existing?.webhookSubscriptionUris) {
    const oldToken = existing.encryptedAccessToken
      ? decryptCalendlyToken(existing.encryptedAccessToken)
      : accessToken;
    await deleteExistingWebhooks(
      oldToken,
      Array.isArray(existing.webhookSubscriptionUris)
        ? existing.webhookSubscriptionUris
        : []
    );
  }

  const subscription = await createCalendlyWebhookSubscription(accessToken, {
    organizationUri,
    userUri,
  });

  const record = await prisma.calendlyIntegration.upsert({
    where: { userId },
    create: {
      userId,
      encryptedAccessToken: encryptCalendlyToken(accessToken),
      encryptedRefreshToken: refreshToken
        ? encryptCalendlyToken(refreshToken)
        : null,
      organizationUri,
      userUri,
      ownerEmail,
      status: "connected",
      webhookSubscriptionUris: [subscription.uri],
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
      status: "connected",
      webhookSubscriptionUris: [subscription.uri],
      connectedAt: new Date(),
    },
  });

  return serializeCalendlyIntegration(record);
}

export async function disconnectCalendly(userId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { userId },
  });
  if (!record) return null;

  try {
    const accessToken = decryptCalendlyToken(record.encryptedAccessToken);
    const uris = Array.isArray(record.webhookSubscriptionUris)
      ? record.webhookSubscriptionUris
      : [];
    await deleteExistingWebhooks(accessToken, uris);
  } catch (err) {
    console.warn("[calendly] disconnect cleanup:", err.message);
  }

  await prisma.calendlyIntegration.delete({ where: { userId } });
  return { disconnected: true };
}

export async function findCalendlyIntegrationByOrganizationUri(organizationUri) {
  if (!organizationUri) return null;
  return prisma.calendlyIntegration.findFirst({
    where: { organizationUri, status: "connected" },
  });
}

export async function findCalendlyIntegrationByUserUri(userUri) {
  if (!userUri) return null;
  return prisma.calendlyIntegration.findFirst({
    where: { userUri, status: "connected" },
  });
}

export async function ensureCalendlyAccessToken(userId) {
  const record = await prisma.calendlyIntegration.findUnique({
    where: { userId },
  });
  if (!record?.encryptedAccessToken) return null;

  try {
    return decryptCalendlyToken(record.encryptedAccessToken);
  } catch {
    if (!record.encryptedRefreshToken) throw new Error("Calendly token invalid");
    const refresh = decryptCalendlyToken(record.encryptedRefreshToken);
    const tokenData = await refreshCalendlyToken(refresh);
    const accessToken = tokenData.access_token;
    await prisma.calendlyIntegration.update({
      where: { userId },
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

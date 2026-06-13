import { getMofuIntegration, isHubspotOAuthConnected } from "@/lib/assist/mofuIntegration";
import { getUserGmailConnection } from "@/lib/gmail/gmailIntegration";

/**
 * AE Assist CRM email — separate from TOFU campaign channels.
 * Available when Gmail is connected (Integrations) or HubSpot Single Send is configured.
 */
export async function getCrmEmailCapabilities(prisma, tenantId, userId) {
  const [gmailRow, mofu] = await Promise.all([
    userId ? getUserGmailConnection(prisma, tenantId, userId) : null,
    getMofuIntegration(prisma, tenantId),
  ]);

  const gmailConnected = gmailRow?.status === "connected";
  const singleSendConfigured = !!mofu?.hubspotSingleSendEmailId;
  const hubspotConnected = isHubspotOAuthConnected(mofu);

  return {
    canSend: gmailConnected || singleSendConfigured,
    gmailConnected,
    gmailEmail: gmailRow?.email ?? null,
    singleSendConfigured,
    hubspotConnected,
    deliveryHint: gmailConnected
      ? "Gmail"
      : singleSendConfigured
        ? "HubSpot Single Send"
        : null,
  };
}

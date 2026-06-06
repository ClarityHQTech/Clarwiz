import {
  getHubSpotIntegration,
  isHubSpotConnected,
  decryptHubSpotToken,
} from "@/lib/hubspot/hubspotIntegration";
import { hubspotFetch } from "@/lib/hubspot/hubspotClient";
import { mapHubSpotDeal, DEAL_PROPERTIES } from "@/lib/hubspot/hubspotMappers";

/**
 * The single SOR implementation (HubSpot). Every method follows the not-connected
 * convention: missing/invalid integration -> {ok:false, reason:"sor_not_connected"},
 * never a throw (mirrors src/lib/push buildSkippedPush).
 */
export const hubspotAdapter = {
  async getDeal(tenantId, hubspotDealId, deps = {}) {
    const integ = await getHubSpotIntegration(tenantId, deps);
    if (!isHubSpotConnected(integ)) return { ok: false, reason: "sor_not_connected" };
    const accessToken = decryptHubSpotToken(integ.encryptedAccessToken);
    try {
      const json = await hubspotFetch(
        `/crm/v3/objects/deals/${hubspotDealId}?properties=${DEAL_PROPERTIES.join(",")}`,
        { accessToken, fetchImpl: deps.fetchImpl }
      );
      return { ok: true, deal: mapHubSpotDeal(json) };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async getDealEngagements(tenantId, hubspotDealId, deps = {}) {
    const integ = await getHubSpotIntegration(tenantId, deps);
    if (!isHubSpotConnected(integ)) return { ok: false, reason: "sor_not_connected" };
    // Engagement timeline ingestion is expanded in Epic 2 / Phase D webhooks.
    return { ok: true, items: [] };
  },
};

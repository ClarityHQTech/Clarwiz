/**
 * Bridge TOFU CampaignContact ↔ MOFU CRM graph via HubSpot custom property
 * `clarwiz_campaign_contact_id` and the stored hubspotDealId on CampaignContact.
 */

/** HubSpot deal/contact/company property storing the Clarwiz CampaignContact id. */
export const CLARWIZ_CAMPAIGN_CONTACT_ID_PROP = "clarwiz_campaign_contact_id";

/** Read the campaign contact id from a HubSpot properties object (or mapped payload). */
export function extractCampaignContactId(payload) {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload[CLARWIZ_CAMPAIGN_CONTACT_ID_PROP];
  if (raw == null || raw === "") return null;
  const id = String(raw).trim();
  return id || null;
}

/**
 * Resolve CampaignContact id during CRM sync:
 * 1) HubSpot custom property on the deal/contact/company payload
 * 2) CampaignContact.hubspotDealId match (set when TOFU pushed the qualified lead)
 */
export async function resolveCampaignContactId(
  prisma,
  tenantId,
  { payload, hubspotDealId } = {}
) {
  const fromProp = extractCampaignContactId(payload);
  if (fromProp) {
    const cc = await prisma.campaignContact.findFirst({
      where: { id: fromProp, campaign: { tenantId } },
      select: { id: true },
    });
    if (cc) return cc.id;
  }

  if (hubspotDealId) {
    const cc = await prisma.campaignContact.findFirst({
      where: { hubspotDealId: String(hubspotDealId), campaign: { tenantId } },
      select: { id: true },
    });
    if (cc) return cc.id;
  }

  return null;
}

/** Best-effort: ensure the HubSpot custom property exists on deal/contact/company. */
export async function ensureClarwizCampaignContactProperty(token, objectType, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://api.hubapi.com/crm/v3/properties/${objectType}/${CLARWIZ_CAMPAIGN_CONTACT_ID_PROP}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return { ok: true, existed: true };

  const groupName =
    objectType === "deals" ? "dealinformation" : objectType === "contacts" ? "contactinformation" : "companyinformation";

  const create = await fetchImpl(`https://api.hubapi.com/crm/v3/properties/${objectType}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: CLARWIZ_CAMPAIGN_CONTACT_ID_PROP,
      label: "Clarwiz Campaign Contact ID",
      type: "string",
      fieldType: "text",
      groupName,
      description: "Clarwiz TOFU campaign enrollment id — links outreach history to this CRM record.",
    }),
  });
  return { ok: create.ok, existed: false };
}

/** Stamp all three CRM object types before a qualified-lead push (never throws). */
export async function ensureClarwizCampaignContactProperties(token, { fetchImpl = fetch } = {}) {
  const types = ["deals", "contacts", "companies"];
  for (const t of types) {
    try {
      await ensureClarwizCampaignContactProperty(token, t, { fetchImpl });
    } catch {
      // Property creation is best-effort; hubspotDealId fallback still links on sync.
    }
  }
}

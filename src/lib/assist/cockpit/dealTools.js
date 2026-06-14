/**
 * Cockpit deal-scoped tools — every fetch is limited to the open deal's graph.
 */
import {
  loadCockpitDealContext,
  compactContactConversations,
  compactDealIntelligenceDetail,
  compactCompanyIntelligenceDetail,
  compactDealRecordingsDetail,
  buildCockpitDealSnapshot,
  loadContactDetailForCockpit,
} from "./dealContext";

const contextCache = new Map();
const CACHE_TTL_MS = 45_000;

function cacheKey(tenantId, dealId) {
  return `${tenantId}:${dealId}`;
}

/** Cached raw context for a single chat request lifecycle. */
export async function getCachedCockpitRawContext(prisma, tenantId, dealId, { refresh = false } = {}) {
  const key = cacheKey(tenantId, dealId);
  const hit = contextCache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.raw;

  const raw = await loadCockpitDealContext(prisma, tenantId, dealId);
  if (raw) contextCache.set(key, { raw, at: Date.now() });
  else contextCache.delete(key);
  return raw;
}

export function clearCockpitContextCache(tenantId, dealId) {
  contextCache.delete(cacheKey(tenantId, dealId));
}

export const COCKPIT_DEAL_TOOLS = [
  {
    name: "refresh_deal_context",
    description:
      "Reload the full internal snapshot for the current deal (deal, company, contacts, TOFU comms, intelligence, signals, NBAs). Use when the AE asks for the latest state after they took an action.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_contact_detail",
    description:
      "Get the full profile for one contact on this deal: phone, email, WhatsApp, LinkedIn, job title, persona, role on deal, company, TOFU score/status, and outreach threads. Use for contact lookup questions (e.g. phone number). contactId must belong to this deal.",
    input_schema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Clarwiz contact id from contacts[] in the deal snapshot" },
      },
      required: ["contactId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_contact_conversations",
    description:
      "Get the full TOFU/MOFU outreach conversation thread for one contact on this deal (all comm logs, replies, channels). Includes contact profile fields. contactId must belong to this deal.",
    input_schema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Clarwiz contact id from the deal snapshot" },
      },
      required: ["contactId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_deal_intelligence_detail",
    description:
      "Get expanded deal intelligence — briefing, GTM paths, risks, coaching, and deeper insight payload fields for this deal only.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_company_intelligence",
    description:
      "Get company/account intelligence linked to this deal (10-tab style payload summary, risks, value themes).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_deal_recordings",
    description:
      "Get HubSpot call/meeting recordings and transcript text for this deal.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export async function executeCockpitDealTool(prisma, tenantId, dealId, name, input = {}) {
  try {
    const raw = await getCachedCockpitRawContext(prisma, tenantId, dealId);
    if (!raw) return JSON.stringify({ error: "deal_not_found" });

    if (name === "refresh_deal_context") {
      clearCockpitContextCache(tenantId, dealId);
      const snapshot = await buildCockpitDealSnapshot(prisma, tenantId, dealId);
      return JSON.stringify(snapshot);
    }

    if (name === "get_contact_detail") {
      const contactId = input?.contactId;
      if (!contactId || !raw.scope.contactIds.includes(contactId)) {
        return JSON.stringify({ error: "contact_not_on_deal" });
      }
      return JSON.stringify(await loadContactDetailForCockpit(prisma, tenantId, dealId, contactId));
    }

    if (name === "get_contact_conversations") {
      const contactId = input?.contactId;
      if (!contactId || !raw.scope.contactIds.includes(contactId)) {
        return JSON.stringify({ error: "contact_not_on_deal" });
      }
      return JSON.stringify(compactContactConversations(raw, contactId));
    }

    if (name === "get_deal_intelligence_detail") {
      return JSON.stringify(compactDealIntelligenceDetail(raw));
    }

    if (name === "get_company_intelligence") {
      return JSON.stringify(compactCompanyIntelligenceDetail(raw));
    }

    if (name === "get_deal_recordings") {
      return JSON.stringify(compactDealRecordingsDetail(raw));
    }

    return JSON.stringify({ error: "unknown_tool" });
  } catch (err) {
    return JSON.stringify({ error: "tool_failed", message: err.message });
  }
}

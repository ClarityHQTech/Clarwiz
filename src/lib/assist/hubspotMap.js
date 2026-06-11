/**
 * Pure HubSpot → Clarwiz CRM-graph mappers + Search request builders.
 * No I/O — unit-tested in isolation; consumed by hubspot.js (live calls) and
 * syncGraph.js (H2 hydration).
 */
import { CLARWIZ_CAMPAIGN_CONTACT_ID_PROP } from "@/lib/crm/campaignContactBridge";

export const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "dealstage",
  "pipeline",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
  "closedate",
  CLARWIZ_CAMPAIGN_CONTACT_ID_PROP,
];

export const CONTACT_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "jobtitle",
  "lifecyclestage",
  "hubspot_owner_id",
  "phone",
  "company",
  CLARWIZ_CAMPAIGN_CONTACT_ID_PROP,
];

export const COMPANY_PROPERTIES = [
  "name",
  "domain",
  "industry",
  "hubspot_owner_id",
  "lifecyclestage",
  CLARWIZ_CAMPAIGN_CONTACT_ID_PROP,
];

/** Flatten HubSpot deal pipelines into { stageId: { label, displayOrder, band, status } }. */
export function buildStageMap(pipelinesJson) {
  const map = {};
  for (const pipeline of pipelinesJson?.results ?? []) {
    const stages = pipeline.stages ?? [];
    const openStages = stages.filter((s) => s.metadata?.isClosed !== "true");
    const openCount = openStages.length || stages.length;
    const earlyCutoff = Math.ceil(openCount / 2); // orders [0, cutoff) = EARLY
    for (const s of stages) {
      const isClosed = s.metadata?.isClosed === "true";
      const isWon =
        isClosed && (s.id === "closedwon" || s.metadata?.probability === "1.0" || /won/i.test(s.label));
      map[s.id] = {
        label: s.label,
        displayOrder: s.displayOrder,
        band: isClosed ? "DEAL_LATE" : s.displayOrder < earlyCutoff ? "DEAL_EARLY" : "DEAL_LATE",
        status: isClosed ? (isWon ? "WON" : "LOST") : "OPEN",
      };
    }
  }
  return map;
}

function toNumberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** HubSpot deal object → Deal graph row shape. */
export function mapHsDeal(hsDeal, stageMap = {}) {
  const p = hsDeal.properties ?? {};
  const stage = stageMap[p.dealstage] ?? null;
  return {
    hubspotDealId: hsDeal.id,
    name: p.dealname || "(unnamed deal)",
    stageLabel: stage?.label ?? p.dealstage ?? null,
    stageBand: stage?.band ?? null,
    status: stage?.status ?? "OPEN",
    amount: toNumberOrNull(p.amount),
    ownerId: p.hubspot_owner_id || null,
    lastActivityAt: toDateOrNull(p.hs_lastmodifieddate),
    payload: p,
  };
}

/** HubSpot contact → BusinessUser/Contact graph row shape. Email lowercased for joins. */
export function mapHsContact(hsContact) {
  const p = hsContact.properties ?? {};
  const email = p.email ? String(p.email).trim().toLowerCase() : null;
  const composed = [p.firstname, p.lastname].filter(Boolean).join(" ").trim();
  const name = composed || (email ? email.split("@")[0] : "(unknown contact)");
  return {
    hubspotContactId: hsContact.id,
    email,
    firstName: p.firstname || null,
    lastName: p.lastname || null,
    name,
    jobTitle: p.jobtitle || null,
    phone: p.phone || null,
    lifecycleStage: p.lifecyclestage || null,
    ownerId: p.hubspot_owner_id || null,
    payload: p,
  };
}

/** HubSpot company → Company/Account graph row shape. */
export function mapHsCompany(hsCompany) {
  const p = hsCompany.properties ?? {};
  return {
    hubspotCompanyId: hsCompany.id,
    name: p.name || p.domain || "(unnamed company)",
    domain: p.domain || null,
    industry: p.industry || null,
    lifecycleStage: p.lifecyclestage || null,
    ownerId: p.hubspot_owner_id || null,
    payload: p,
  };
}

/** Dedupe HubSpot v3 association result blocks into id arrays. */
export function dedupeAssociations(associations) {
  const pick = (key) => [
    ...new Set((associations?.[key]?.results ?? []).map((r) => r.id)),
  ];
  return { companies: pick("companies"), contacts: pick("contacts") };
}

/** CRM Search body for open deals, optionally filtered to an owner. */
export function buildOpenDealsSearch({ ownerId = null, limit = 100, after } = {}) {
  const filters = [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }];
  if (ownerId) {
    filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: ownerId });
  }
  const body = {
    filterGroups: [{ filters }],
    properties: DEAL_PROPERTIES,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    limit,
  };
  if (after) body.after = after;
  return body;
}

/** CRM Search body for MQL contacts, optionally filtered to an owner. */
/** Lifecycle stages we treat as "open leads" (pre-deal). HubSpot defaults + common custom. */
export const LEAD_LIFECYCLE_STAGES = [
  "lead",
  "marketingqualifiedlead",
  "salesqualifiedlead",
  "subscriber",
  "opportunity",
];

export function buildMqlContactsSearch({ ownerId = null, limit = 100, after } = {}) {
  const filters = [
    { propertyName: "lifecyclestage", operator: "IN", values: LEAD_LIFECYCLE_STAGES },
  ];
  if (ownerId) {
    filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: ownerId });
  }
  const body = {
    filterGroups: [{ filters }],
    properties: CONTACT_PROPERTIES,
    limit,
  };
  if (after) body.after = after;
  return body;
}

/**
 * SorAdapter — the single seam through which the MOFU brain reads/writes the
 * system of record. v1 has EXACTLY ONE implementation (HubSpot). A second SOR
 * would be added here without touching the brain. Do NOT write a second adapter.
 *
 * @typedef {Object} LiveDealFields
 * @property {string|null} stage
 * @property {string|null} owner
 * @property {number|null} amount
 * @property {string|null} currency
 * @property {Array<{kind:string, occurredAt:string, summary?:string, externalId:string}>} timeline
 *
 * @typedef {Object} SorDeal
 * @property {string} hubspotDealId
 * @property {string|null} name
 * @property {LiveDealFields} live
 * @property {Object} raw
 *
 * Contract:
 *   getDeal(tenantId, hubspotDealId): Promise<{ok:true, deal:SorDeal} | {ok:false, reason:string}>
 *   getDealEngagements(tenantId, hubspotDealId): Promise<{ok:true, items:Array} | {ok:false, reason:string}>
 * Not-connected always resolves to {ok:false, reason:"sor_not_connected"} — never throws.
 */
import { hubspotAdapter } from "@/lib/sor/hubspotAdapter";

export function getSorAdapter() {
  return hubspotAdapter; // single impl in v1
}

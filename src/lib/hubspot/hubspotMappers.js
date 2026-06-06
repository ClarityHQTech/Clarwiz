// Pure HubSpot JSON -> Clarwiz shape mappers. No I/O, fully unit-testable.

const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "hubspot_owner_id",
  "amount",
  "deal_currency_code",
];

export { DEAL_PROPERTIES };

/** Map a HubSpot deal object (crm/v3/objects/deals) to live volatile fields. */
export function mapHubSpotDeal(hs) {
  const p = hs?.properties ?? {};
  const amountNum = p.amount != null && p.amount !== "" ? Number(p.amount) : null;
  return {
    hubspotDealId: hs?.id != null ? String(hs.id) : null,
    name: p.dealname ?? null,
    live: {
      stage: p.dealstage ?? null,
      owner: p.hubspot_owner_id ?? null,
      amount: Number.isFinite(amountNum) ? amountNum : null,
      currency: p.deal_currency_code ?? null,
      timeline: [],
    },
    raw: hs ?? {},
  };
}

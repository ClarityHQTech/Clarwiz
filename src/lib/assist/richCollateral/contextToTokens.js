import { buildTenantProspectTokens } from "@/lib/assist/richCollateral/tenantTokens";

/**
 * Map assembleProspectContext output → rich template {{tokens}}.
 */
export function contextToRichTokens(context = {}, assets = []) {
  const assetBrief = context.assetBrief || {};
  const contact = (context.contacts || [])[0] || {};

  const extra = {
    hero_subhead: assetBrief.rationale || assetBrief.emailDetail || undefined,
    battlecard_intro: assetBrief.rationale || undefined,
    deck_intro: assetBrief.emailDetail || assetBrief.rationale || undefined,
  };

  Object.keys(extra).forEach((k) => {
    if (extra[k] === undefined) delete extra[k];
  });

  return buildTenantProspectTokens({
    tenant: {
      name: context.seller?.name,
      company_details: context.seller?.company_details,
    },
    prospect: context.prospect || {},
    contact,
    deal: context.deal || {},
    brand: context.brand || {},
    assets,
    extra,
  });
}

import { summarizeAvailableFacts } from "@/lib/assist/collateralGen";

/**
 * Normalize tenant + prospect context for rich HTML hyper-personalization.
 */
export function buildRichPersonalizationContext(context = {}) {
  const seller = context.seller || {};
  const prospect = context.prospect || {};
  const contact = (context.contacts || [])[0] || context.contact || {};
  const deal = context.deal || {};

  return {
    seller: {
      name: seller.name ?? null,
      company_details: seller.company_details ?? null,
    },
    prospect: {
      name: prospect.name ?? null,
      domain: prospect.domain ?? null,
      industry: prospect.industry ?? null,
      lifecycleStage: prospect.lifecycleStage ?? null,
    },
    contact: {
      name: contact.name ?? null,
      title: contact.title ?? null,
      role: contact.role ?? null,
    },
    deal: {
      name: deal.name ?? null,
      stage: deal.stage ?? null,
      amount: deal.amount ?? null,
    },
    brand: context.brand ?? null,
    insights: context.insights ?? null,
    signals: context.signals ?? null,
    assetBrief: context.assetBrief ?? null,
    availableFacts: summarizeAvailableFacts(context),
  };
}

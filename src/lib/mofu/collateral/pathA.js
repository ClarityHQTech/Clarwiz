import { prisma as defaultPrisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/mofu/collateral/brand";
import { renderTemplate } from "@/lib/mofu/collateral/renderer";

// US-7.1 — Path A marketing collateral: code-template + brand cascade, no LLM.
export async function generateMarketingCollateral(
  { tenantId, dealId, templateId = "one_pager", type = "MARKETING_COLLATERAL", data = {}, brand = {} },
  deps = {}
) {
  const prisma = deps.prisma ?? defaultPrisma;
  const resolved = resolveBrand(brand);
  const html = renderTemplate(templateId, data, resolved);
  const doc = await prisma.document.create({
    data: {
      tenantId,
      dealId,
      type,
      path: "A",
      contentJson: { templateId, data },
      renderedHtml: html,
      brand: resolved,
      status: "READY",
      version: 1,
    },
  });
  return { ok: true, documentId: doc.id, html };
}

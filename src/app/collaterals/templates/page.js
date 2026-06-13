import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { removeBuiltInCollateralTemplates } from "@/lib/assist/builtInCollateralTemplates";
import { ensureRichCollateralTemplates } from "@/lib/assist/richCollateral/seedRichTemplates";
import { getCollateralAssets } from "@/lib/assist/richCollateral/collateralAssets";
import { isPredefinedCollateralRow } from "@/lib/assist/richCollateral/predefinedTemplates";
import CollateralTemplatesClient from "@/components/assist/collateral/CollateralTemplatesClient";

export default async function CollateralTemplatesPage() {
  const ctx = await getAuthContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) notFound();

  await removeBuiltInCollateralTemplates(prisma, tenantId);
  await ensureRichCollateralTemplates(prisma, tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { company_details: true },
  });

  const rows = await prisma.collateralIndex.findMany({
    where: { tenantId, isTemplate: true },
    orderBy: { createdAt: "desc" },
  });

  const templateItems = rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    category: r.category ?? null,
    isTemplate: true,
    source: r.source,
    externalId: r.externalId ?? null,
    url: r.url ?? null,
    slug: r.slug ?? null,
    funnelStage: r.funnelStage,
    tags: r.tags ?? [],
    companyHsId: r.companyHsId ?? null,
    dealHsId: r.dealHsId ?? null,
    createdAt: r.createdAt.toISOString(),
    isPredefined: isPredefinedCollateralRow(r),
  }));

  return (
    <CollateralTemplatesClient
      templateItems={templateItems}
      collateralAssets={getCollateralAssets(tenant?.company_details)}
    />
  );
}

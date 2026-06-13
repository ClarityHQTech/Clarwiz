import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { removeBuiltInCollateralTemplates } from "@/lib/assist/builtInCollateralTemplates";
import { ensureRichCollateralTemplates } from "@/lib/assist/richCollateral/seedRichTemplates";
import { enrichCreatedCollaterals } from "@/lib/assist/enrichCreatedCollaterals";
import { isPredefinedCollateralRow } from "@/lib/assist/richCollateral/predefinedTemplates";
import CollateralClient from "@/components/assist/collateral/CollateralClient";

export default async function CollateralsPage() {
  const ctx = await getAuthContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) notFound();

  await removeBuiltInCollateralTemplates(prisma, tenantId);
  await ensureRichCollateralTemplates(prisma, tenantId);

  const [rows, templateRows, dealRows] = await Promise.all([
    prisma.collateralIndex.findMany({
      where: { tenantId, isTemplate: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.collateralIndex.findMany({
      where: { tenantId, isTemplate: true },
      orderBy: { title: "asc" },
    }),
    prisma.deal.findMany({
      where: { tenantId, status: "OPEN" },
      orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        stageLabel: true,
        account: { select: { company: { select: { name: true } } } },
      },
    }),
  ]);

  const createdItems = await enrichCreatedCollaterals(prisma, tenantId, rows);

  const templates = templateRows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    category: r.category ?? null,
    isPredefined: isPredefinedCollateralRow(r),
  }));

  const deals = dealRows.map((d) => ({
    id: d.id,
    name: d.name,
    stageLabel: d.stageLabel ?? null,
    companyName: d.account?.company?.name ?? null,
  }));

  return <CollateralClient createdItems={createdItems} deals={deals} templates={templates} />;
}

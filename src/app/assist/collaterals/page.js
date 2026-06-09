import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import CollateralClient from "@/components/assist/collateral/CollateralClient";

/**
 * Collateral Hub — server component. Reads the tenant's CollateralIndex and
 * hands serializable rows to the client. (Split pattern: no DashboardLayout
 * here; the client wrapper applies it — see CollateralClient.)
 */
export default async function CollateralsPage() {
  const ctx = await getAuthContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) notFound();

  const rows = await prisma.collateralIndex.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    category: r.category ?? null,
    isTemplate: r.isTemplate ?? false,
    source: r.source,
    externalId: r.externalId ?? null,
    url: r.url ?? null,
    slug: r.slug ?? null,
    funnelStage: r.funnelStage,
    tags: r.tags ?? [],
    companyHsId: r.companyHsId ?? null,
    dealHsId: r.dealHsId ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return <CollateralClient items={items} />;
}

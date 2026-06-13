/**
 * Join CollateralIndex instance rows with Deal / Account / Company names for the hub UI.
 */
export async function enrichCreatedCollaterals(prisma, tenantId, rows) {
  const created = rows.filter((r) => !r.isTemplate);
  if (!created.length) return [];

  const dealHsIds = [...new Set(created.map((r) => r.dealHsId).filter(Boolean))];
  const companyHsIds = [...new Set(created.map((r) => r.companyHsId).filter(Boolean))];

  const [deals, accounts] = await Promise.all([
    dealHsIds.length
      ? prisma.deal.findMany({
          where: { tenantId, hubspotDealId: { in: dealHsIds } },
          select: {
            id: true,
            hubspotDealId: true,
            name: true,
            stageLabel: true,
            account: {
              select: {
                hubspotCompanyId: true,
                company: { select: { name: true } },
              },
            },
          },
        })
      : [],
    companyHsIds.length
      ? prisma.account.findMany({
          where: { tenantId, hubspotCompanyId: { in: companyHsIds } },
          select: {
            hubspotCompanyId: true,
            company: { select: { name: true } },
          },
        })
      : [],
  ]);

  const dealByHs = new Map(deals.map((d) => [d.hubspotDealId, d]));
  const accountByHs = new Map(accounts.map((a) => [a.hubspotCompanyId, a]));

  return created.map((r) => {
    const deal = r.dealHsId ? dealByHs.get(r.dealHsId) : null;
    const account = r.companyHsId ? accountByHs.get(r.companyHsId) : null;
    const companyName =
      account?.company?.name ??
      deal?.account?.company?.name ??
      (r.companyHsId ? "Linked account" : null);

    return {
      id: r.id,
      title: r.title,
      type: r.type,
      category: r.category ?? null,
      source: r.source,
      externalId: r.externalId ?? null,
      dealHsId: r.dealHsId ?? null,
      companyHsId: r.companyHsId ?? null,
      dealId: deal?.id ?? null,
      dealName: deal?.name ?? null,
      dealStage: deal?.stageLabel ?? null,
      companyName,
      funnelStage: r.funnelStage,
      tags: r.tags ?? [],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

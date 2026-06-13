/**
 * Built-in starter templates were auto-seeded on the Collateral Hub. They are
 * removed — tenants manage their own template library via Register template.
 */

export const BUILT_IN_COLLATERAL_SLUGS = [
  "default-one-pager",
  "default-battlecard",
  "default-case-study",
  "default-marketing-doc",
  "default-pitch-deck",
  "default-email-template",
  "default-roi-doc",
];

/** Legacy + v2 seeded titles (rows created before slugs were attached). */
export const BUILT_IN_COLLATERAL_TITLES = [
  "Sales One-Pager — Brand Template",
  "Executive One-Pager — Brand Template",
  "Competitive Battlecard — Brand Template",
  "Competitive Comparison — Brand Template",
  "Customer Case Study — Brand Template",
  "Customer Success Story — Brand Template",
  "Product Overview — Brand Template",
  "Pitch Deck Outline — Brand Template",
  "Discovery Brief — Brand Template",
  "Post-Demo Follow-Up — Brand Template",
  "Meeting Recap Brief — Brand Template",
  "ROI Business Case — Brand Template",
];

/**
 * Remove auto-seeded built-in templates for a tenant (index row + linked Document).
 * Idempotent — safe to run on every Collateral Hub visit.
 *
 * @returns {Promise<{ removed: number }>}
 */
export async function removeBuiltInCollateralTemplates(prisma, tenantId) {
  const rows = await prisma.collateralIndex.findMany({
    where: {
      tenantId,
      isTemplate: true,
      OR: [
        { slug: { in: BUILT_IN_COLLATERAL_SLUGS } },
        { title: { in: BUILT_IN_COLLATERAL_TITLES } },
      ],
    },
    select: { id: true, externalId: true },
  });

  if (!rows.length) return { removed: 0 };

  const documentIds = rows.map((r) => r.externalId).filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.collateralIndex.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
    if (documentIds.length) {
      await tx.document.deleteMany({
        where: { tenantId, id: { in: documentIds } },
      });
    }
  });

  // Drop legacy suppression list — built-ins are no longer seeded.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { company_details: true },
  });
  const cd = tenant?.company_details;
  if (cd && typeof cd === "object" && cd.assist?.suppressedCollateralSlugs) {
    const next = { ...cd, assist: { ...cd.assist } };
    delete next.assist.suppressedCollateralSlugs;
    if (Object.keys(next.assist).length === 0) delete next.assist;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { company_details: next },
    });
  }

  return { removed: rows.length };
}

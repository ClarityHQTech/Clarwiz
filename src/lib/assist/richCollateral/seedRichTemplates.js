import { getTenantBrand } from "@/lib/assist/collateralGen";
import {
  RICH_TEMPLATE_CATALOG,
  renderRichTemplate,
} from "@/lib/assist/richCollateral/fillRichTemplate";
import { getCollateralAssets } from "@/lib/assist/richCollateral/collateralAssets";
import {
  getSuppressedPredefinedSlugs,
  LEGACY_PREDEFINED_SLUGS,
  PREDEFINED_TAG,
  SYSTEM_TAG,
} from "@/lib/assist/richCollateral/predefinedTemplates";
import { buildTenantProspectTokens } from "@/lib/assist/richCollateral/tenantTokens";

/**
 * Remove legacy Clarwiz-branded slug rows (pre-tenant-variable templates).
 */
async function removeLegacyPredefinedRows(prisma, tenantId) {
  const legacy = await prisma.collateralIndex.findMany({
    where: {
      tenantId,
      isTemplate: true,
      slug: { in: LEGACY_PREDEFINED_SLUGS },
    },
    select: { id: true, externalId: true },
  });
  if (!legacy.length) return;
  const docIds = legacy.map((r) => r.externalId).filter(Boolean);
  await prisma.$transaction(async (tx) => {
    await tx.collateralIndex.deleteMany({ where: { id: { in: legacy.map((r) => r.id) } } });
    if (docIds.length) {
      await tx.document.deleteMany({ where: { tenantId, id: { in: docIds } } });
    }
  });
}

/**
 * Upsert the three system predefined HTML templates for a tenant.
 * Skips templates the tenant removed from workspace (suppressed slugs).
 * Templates are read-only — content is refreshed from source HTML on each visit.
 */
export async function ensureRichCollateralTemplates(prisma, tenantId) {
  let created = 0;
  let updated = 0;

  await removeLegacyPredefinedRows(prisma, tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, company_details: true },
  });
  if (!tenant) return { created: 0, updated: 0 };

  const brand = getTenantBrand(tenant);
  const assets = getCollateralAssets(tenant?.company_details);
  const suppressed = getSuppressedPredefinedSlugs(tenant.company_details);

  const tokens = buildTenantProspectTokens({
    tenant,
    prospect: { name: "Sample Prospect Co.", industry: "Technology" },
    contact: { name: "Sample Champion", title: "VP Sales" },
    brand,
    assets,
  });

  for (const [key, meta] of Object.entries(RICH_TEMPLATE_CATALOG)) {
    if (suppressed.has(meta.slug)) continue;

    const html = renderRichTemplate(key, tokens);
    const templateJson = JSON.stringify({
      richTemplateKey: key,
      isPredefined: true,
      readOnly: true,
      previewOnly: true,
    });
    const tags = [...new Set([...(meta.tags || []), PREDEFINED_TAG, SYSTEM_TAG])];

    let existing = await prisma.collateralIndex.findFirst({
      where: { tenantId, slug: meta.slug, isTemplate: true },
      select: { id: true, externalId: true },
    });

    if (existing?.externalId) {
      await prisma.document.update({
        where: { id: existing.externalId },
        data: {
          title: meta.title,
          html,
          template: templateJson,
          data: { richTemplateKey: key, isPredefined: true, readOnly: true, previewOnly: true },
        },
      });
      await prisma.collateralIndex.update({
        where: { id: existing.id },
        data: {
          title: meta.title,
          type: meta.type,
          category: meta.category,
          tags,
          source: "UPLOAD",
          isTemplate: true,
        },
      });
      updated += 1;
      continue;
    }

    const document = await prisma.document.create({
      data: {
        tenantId,
        title: meta.title,
        html,
        template: templateJson,
        data: { richTemplateKey: key, isPredefined: true, readOnly: true, previewOnly: true },
      },
    });

    await prisma.collateralIndex.create({
      data: {
        tenantId,
        title: meta.title,
        type: meta.type,
        category: meta.category,
        slug: meta.slug,
        source: "UPLOAD",
        isTemplate: true,
        externalId: document.id,
        funnelStage: "ANY",
        tags,
      },
    });
    created += 1;
  }

  return { created, updated };
}

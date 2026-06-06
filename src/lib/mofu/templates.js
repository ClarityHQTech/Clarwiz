import { prisma as defaultPrisma } from "@/lib/prisma";
import { AVAILABLE_TEMPLATES } from "@/lib/mofu/collateral/renderer";
import { buildOntology } from "@/lib/mofu/contextOntology";

// Collateral template catalog: built-in code templates + uploaded HTML templates,
// each categorised marketing | sales. Backed by the CollateralTemplate model.

export function builtinTemplates() {
  return AVAILABLE_TEMPLATES.map((id) => ({
    id: `builtin:${id}`,
    title: id.replace(/_/g, " "),
    category: "marketing",
    source: "builtin",
  }));
}

export async function listTemplates({ tenantId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const custom = await prisma.collateralTemplate.findMany({
    where: { OR: [{ tenantId }, { tenantId: null }], enabled: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    builtin: builtinTemplates(),
    custom: custom.map((t) => ({ id: t.id, title: t.title, category: t.category, source: t.source })),
  };
}

export async function createTemplate({ tenantId, title, category = "marketing", html, schema = null }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  if (!title?.trim()) return { ok: false, reason: "title_required" };
  if (!html?.trim()) return { ok: false, reason: "html_required" };
  const cat = category === "sales" ? "sales" : "marketing";
  const row = await prisma.collateralTemplate.create({
    data: {
      tenantId,
      templateId: title.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 60),
      title: title.trim(),
      html,
      schema,
      category: cat,
      source: "uploaded",
    },
  });
  return { ok: true, template: { id: row.id, title: row.title, category: row.category } };
}

export async function deleteTemplate({ tenantId, id }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  await prisma.collateralTemplate.deleteMany({ where: { id, tenantId } });
  return { ok: true };
}

/** Load a deal's stored context + signals and build the ontology (for generation). */
export async function loadDealOntology({ tenantId, dealId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const [deal, signals] = await Promise.all([
    prisma.deal.findFirst({ where: { id: dealId, tenantId }, include: { context: true } }),
    prisma.dealSignal.findMany({ where: { tenantId, dealId }, orderBy: { score: "desc" }, take: 50 }),
  ]);
  if (!deal) return null;
  const cached = deal.context?.data?.cached ?? {};
  return buildOntology({
    deal: { name: deal.name, stage: deal.cachedStage, amount: deal.cachedAmount, currency: deal.cachedCurrency },
    company: cached.company,
    contacts: cached.contacts ?? [],
    engagements: cached.engagements ?? [],
    signals,
  });
}

import { prisma as defaultPrisma } from "@/lib/prisma";
import { AVAILABLE_TEMPLATES } from "@/lib/mofu/collateral/renderer";

// Marketing/collateral template catalog. Built-in code templates (Path A) are
// always available; tenants can also author custom NbaTemplate entries ("input
// templates if not there"), which are generated on demand ("fetch when needed").

export function builtinTemplates() {
  return AVAILABLE_TEMPLATES.map((id) => ({
    id: `builtin:${id}`,
    title: id.replace(/_/g, " "),
    path: "A",
    actionType: "SEND_MARKETING_COLLATERAL",
    builtin: true,
    templateId: id,
  }));
}

export async function listTemplates({ tenantId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const custom = await prisma.nbaTemplate.findMany({
    where: { OR: [{ tenantId }, { tenantId: null }], enabled: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    builtin: builtinTemplates(),
    custom: custom.map((t) => ({
      id: t.id,
      title: t.title,
      actionType: t.actionType,
      collateralTemplateId: t.collateralTemplateId,
      promptScaffold: t.promptScaffold,
      builtin: false,
    })),
  };
}

export async function createTemplate(
  { tenantId, title, actionType = "SEND_MARKETING_COLLATERAL", collateralTemplateId = null, promptScaffold = "" },
  deps = {}
) {
  const prisma = deps.prisma ?? defaultPrisma;
  if (!title?.trim()) return { ok: false, reason: "title_required" };
  const row = await prisma.nbaTemplate.create({
    data: { tenantId, title: title.trim(), actionType, collateralTemplateId, promptScaffold, enabled: true },
  });
  return { ok: true, template: { id: row.id, title: row.title, actionType: row.actionType } };
}

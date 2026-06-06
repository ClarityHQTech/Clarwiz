import { prisma as defaultPrisma } from "@/lib/prisma";

const iso = (d) => (d ? new Date(d).toISOString() : null);

export function serializeDoc(d) {
  return {
    id: d.id,
    type: d.type,
    path: d.path,
    status: d.status,
    version: d.version,
    title: d.contentJson?.asset?.title ?? d.contentJson?.templateId ?? d.type,
    stage: d.contentJson?.stage ?? null,
    trace: d.contentJson?.trace ?? [],
    hasHtml: !!d.renderedHtml,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

export async function listDealDocuments({ tenantId, dealId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const docs = await prisma.document.findMany({ where: { tenantId, dealId }, orderBy: { createdAt: "desc" } });
  return docs.map(serializeDoc);
}

export async function getDocument({ tenantId, documentId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const d = await prisma.document.findFirst({ where: { id: documentId, tenantId } });
  if (!d) return { ok: false, reason: "not_found" };
  return { ok: true, document: { ...serializeDoc(d), renderedHtml: d.renderedHtml, contentJson: d.contentJson } };
}

import { prisma as defaultPrisma } from "@/lib/prisma";
import { scoreSignal } from "@/lib/mofu/signalScoring";

const MAX_PER_KIND = 25;

/**
 * US-2.1 — Turn a HubSpot transcript/email/stage-change into a scored DealSignal.
 * Dedupe by (tenantId, source, kind, externalId) via idempotent upsert. The
 * signalReferenceId is derived from the unique key (never fabricated). Malformed
 * payloads are skipped with a warning, never thrown. Volume bounded per kind.
 */
export async function ingestSignal(input, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const now = deps.now ?? new Date();
  const { tenantId, dealId, kind, source, externalId } = input;

  if (!tenantId || !dealId || !kind || !source || !externalId) {
    return { ok: false, skipped: true, reason: "malformed" };
  }

  const signalReferenceId = `${source}:${kind}:${externalId}`;
  const score = scoreSignal({
    kind,
    occurredAt: input.occurredAt,
    now,
    intentHints: input.intentHints ?? [],
  });

  const signal = await prisma.dealSignal.upsert({
    where: { tenantId_source_kind_externalId: { tenantId, source, kind, externalId } },
    create: {
      tenantId,
      dealId,
      scope: input.scope ?? "DEAL",
      kind,
      source,
      externalId,
      summary: input.summary ?? null,
      score,
      signalReferenceId,
      contactId: input.contactId ?? null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
      raw: input.raw ?? undefined,
    },
    update: {
      summary: input.summary ?? undefined,
      score,
      contactId: input.contactId ?? undefined,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      raw: input.raw ?? undefined,
    },
  });

  // Bound volume: keep most-recent N per (deal, kind).
  const count = await prisma.dealSignal.count({ where: { tenantId, dealId, kind } });
  if (count > MAX_PER_KIND) {
    const stale = await prisma.dealSignal.findMany({
      where: { tenantId, dealId, kind },
      orderBy: { createdAt: "desc" },
      skip: MAX_PER_KIND,
      select: { id: true },
    });
    if (stale.length) {
      await prisma.dealSignal.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  }

  return { ok: true, signal };
}

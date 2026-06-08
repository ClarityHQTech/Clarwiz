import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getTenantInternalDomains } from "@/lib/assist/internalDomains";
import { selectNoiseAccounts } from "@/lib/assist/cleanupNoise";

// Tenant-admin only; usable before payment (it's a housekeeping action).
const AUTH = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false, tenantAdmin: true };

/**
 * POST (tenant admin) — one-time, SAFE cleanup of already-synced internal /
 * email-noise company records.
 *
 * Query `?dryRun=1` or body `{ dryRun: true }` previews without deleting.
 *
 * "Noise" is decided purely by `selectNoiseAccounts`: 0-deal accounts whose
 * domain is internal, plus orphaned domain-synthetic accounts (0 deals, no
 * linked contact). Accounts with deals are NEVER touched.
 *
 * Deletes are wrapped in a transaction and are idempotent / safe to re-run.
 * `CompanyInsight` and `Signal` cascade on Account delete (per schema), so they
 * need no manual cleanup. Global `Company` rows are left in place (shared); we
 * unlink the tenant's own contacts' people from those companies first so a
 * later sync doesn't immediately re-create the noise account.
 *
 * Returns: { ok, dryRun, candidates: [{id,name,domain}], deleted: <n> }
 */
export async function POST(request) {
  const auth = await resolveApiAuth(AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const tenantId = ctx.tenantId;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const url = new URL(request.url);
  const dryRun =
    body?.dryRun === true || ["1", "true"].includes(url.searchParams.get("dryRun") || "");

  const [internalDomains, accounts] = await Promise.all([
    getTenantInternalDomains(prisma, tenantId),
    prisma.account.findMany({
      where: { tenantId },
      select: {
        id: true,
        hubspotCompanyId: true,
        companyId: true,
        company: { select: { name: true, domain: true } },
        _count: { select: { deals: true } },
      },
    }),
  ]);

  // For each account's company, how many contacts does THIS tenant have whose
  // person is linked to that company? Drives the orphan-synthetic rule.
  const companyIds = [...new Set(accounts.map((a) => a.companyId).filter(Boolean))];
  const contactCounts = new Map();
  if (companyIds.length) {
    const grouped = await prisma.businessUser.findMany({
      where: {
        companyId: { in: companyIds },
        contacts: { some: { tenantId } },
      },
      select: { companyId: true },
    });
    for (const g of grouped) {
      contactCounts.set(g.companyId, (contactCounts.get(g.companyId) || 0) + 1);
    }
  }

  const projected = accounts.map((a) => ({
    id: a.id,
    name: a.company?.name || a.hubspotCompanyId || a.id,
    hubspotCompanyId: a.hubspotCompanyId,
    companyId: a.companyId,
    dealCount: a._count?.deals || 0,
    contactCount: a.companyId ? contactCounts.get(a.companyId) || 0 : 0,
    company: { domain: a.company?.domain || null },
  }));

  const noiseIds = new Set(selectNoiseAccounts(projected, internalDomains));
  const selected = projected.filter((a) => noiseIds.has(a.id));

  const candidates = selected.map((a) => ({
    id: a.id,
    name: a.name,
    domain: a.company.domain,
  }));

  if (dryRun || candidates.length === 0) {
    return NextResponse.json({ ok: true, dryRun, candidates, deleted: 0 });
  }

  const idsToDelete = selected.map((a) => a.id);
  const companyIdsToClear = [...new Set(selected.map((a) => a.companyId).filter(Boolean))];

  const deleted = await prisma.$transaction(async (tx) => {
    // Unlink this tenant's contacts' people from the companies being removed so
    // a later sync doesn't immediately re-enrich them into a new noise account.
    if (companyIdsToClear.length) {
      await tx.businessUser.updateMany({
        where: {
          companyId: { in: companyIdsToClear },
          contacts: { some: { tenantId } },
        },
        data: { companyId: null },
      });
    }

    // CompanyInsight + Signal cascade on Account delete; just delete the
    // Accounts. Scope to tenantId for safety/idempotency.
    const res = await tx.account.deleteMany({
      where: { id: { in: idsToDelete }, tenantId },
    });
    return res.count;
  });

  return NextResponse.json({ ok: true, dryRun: false, candidates, deleted });
}

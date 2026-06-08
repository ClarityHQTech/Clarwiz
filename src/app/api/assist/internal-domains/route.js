import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { domainFromEmail } from "@/lib/assist/companyResolve";
import { getConfiguredInternalDomains, normalizeDomain } from "@/lib/assist/internalDomains";

// Read before payment gating; saving is restricted to tenant admins.
const AUTH = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false };

/** Member-derived (auto-detected) internal domains — shown read-only. */
async function detectedDomains(tenantId) {
  const members = await prisma.tenantMembership.findMany({
    where: { tenantId },
    select: { user: { select: { email: true } } },
  });
  const set = new Set();
  for (const m of members) {
    const d = domainFromEmail(m.user?.email);
    if (d) set.add(d);
  }
  return [...set];
}

/**
 * GET — the tenant's internal-domain config.
 *   { configured: string[], detected: string[] }
 * `configured` is the AE-editable list; `detected` is derived from members'
 * login emails (read-only in the UI).
 */
export async function GET() {
  const auth = await resolveApiAuth(AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const [tenant, detected] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { company_details: true },
    }),
    detectedDomains(ctx.tenantId),
  ]);

  return NextResponse.json({
    configured: getConfiguredInternalDomains(tenant),
    detected,
  });
}

/**
 * POST (tenant admin) — replace the configured internal-domain list.
 * Body: { domains: string[] }. Entries are normalized (lowercased, leading
 * `@`/`www.` and any URL cruft stripped) and deduped; invalid entries dropped.
 * Merges into `company_details.internalDomains` without clobbering brand/other
 * keys. Returns the saved list + the current detected list.
 */
export async function POST(request) {
  const auth = await resolveApiAuth({ ...AUTH, tenantAdmin: true });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const incoming = Array.isArray(body?.domains) ? body.domains : [];
  const set = new Set();
  for (const raw of incoming) {
    const d = normalizeDomain(raw);
    if (d) set.add(d);
  }
  const internalDomains = [...set];

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { company_details: true },
  });
  const cd =
    tenant?.company_details && typeof tenant.company_details === "object"
      ? tenant.company_details
      : {};

  const company_details = { ...cd, internalDomains };

  await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { company_details },
  });

  const detected = await detectedDomains(ctx.tenantId);
  return NextResponse.json({ configured: internalDomains, detected });
}

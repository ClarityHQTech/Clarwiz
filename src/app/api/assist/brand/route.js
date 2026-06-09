import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getTenantBrand } from "@/lib/assist/collateralGen";

const FIELDS = ["primary", "accent", "fontHeading", "fontBody", "logoUrl", "tagline"];

// Brand is read before payment gating; saving is restricted to tenant admins.
const AUTH = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false };

/**
 * GET — the tenant brand used by the renderer / personalization, read from
 * `Tenant.company_details.brand` with warm-amber defaults.
 */
export async function GET() {
  const auth = await resolveApiAuth(AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { company_details: true },
  });

  return NextResponse.json({ brand: getTenantBrand(tenant) });
}

/**
 * POST (tenant admin) — merge brand fields into `company_details.brand` without
 * clobbering other company_details keys. Empty strings clear a field (fall back
 * to defaults on read).
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

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { company_details: true },
  });

  const cd =
    tenant?.company_details && typeof tenant.company_details === "object"
      ? tenant.company_details
      : {};
  const existingBrand =
    cd.brand && typeof cd.brand === "object" ? cd.brand : {};

  const brand = { ...existingBrand };
  for (const key of FIELDS) {
    if (key in body) {
      const v = typeof body[key] === "string" ? body[key].trim() : "";
      brand[key] = v || null;
    }
  }

  const company_details = { ...cd, brand };

  await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { company_details },
  });

  return NextResponse.json({ brand: getTenantBrand({ company_details }) });
}

import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getCollateralAssets,
  upsertCollateralAsset,
  removeCollateralAsset,
} from "@/lib/assist/richCollateral/collateralAssets";

const VIEW = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false };
const MANAGE = { permission: PERMISSIONS.COLLATERAL_MANAGE, requirePaid: false };

/** GET — list tenant collateral image assets. */
export async function GET() {
  const auth = await resolveApiAuth(VIEW);
  if (auth.error) return auth.error;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.ctx.tenantId },
    select: { company_details: true },
  });

  return NextResponse.json({ assets: getCollateralAssets(tenant?.company_details) });
}

/** POST — add or update an asset { id?, title, url, role? }. */
export async function POST(request) {
  const auth = await resolveApiAuth(MANAGE);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "valid_url_required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.ctx.tenantId },
    select: { company_details: true },
  });

  const company_details = upsertCollateralAsset(tenant?.company_details ?? null, {
    id: body?.id,
    title: body?.title,
    url,
    role: body?.role,
  });

  await prisma.tenant.update({
    where: { id: auth.ctx.tenantId },
    data: { company_details },
  });

  return NextResponse.json({ assets: getCollateralAssets(company_details) });
}

/** DELETE ?id= — remove an asset. */
export async function DELETE(request) {
  const auth = await resolveApiAuth(MANAGE);
  if (auth.error) return auth.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.ctx.tenantId },
    select: { company_details: true },
  });

  const company_details = removeCollateralAsset(tenant?.company_details ?? null, id);
  await prisma.tenant.update({
    where: { id: auth.ctx.tenantId },
    data: { company_details },
  });

  return NextResponse.json({ assets: getCollateralAssets(company_details) });
}

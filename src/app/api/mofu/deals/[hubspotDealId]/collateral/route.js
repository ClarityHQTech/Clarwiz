import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { generateMarketingCollateral } from "@/lib/mofu/collateral/pathA";
import { enqueueSalesCollateral } from "@/lib/mofu/collateral/pathB";

// POST /api/mofu/deals/:hubspotDealId/collateral
//   { path: "A", templateId?, data?, brand? }  -> marketing one-pager (sync)
//   { path: "B", brief? }                       -> sales asset (queued job)
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_GENERATE });
  if (auth.error) return auth.error;

  const deal = await prisma.deal.findUnique({
    where: { tenantId_hubspotDealId: { tenantId: auth.ctx.tenantId, hubspotDealId: params.hubspotDealId } },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* defaults */
  }

  if (body.path === "B") {
    const out = await enqueueSalesCollateral(
      { tenantId: auth.ctx.tenantId, dealId: deal.id, type: body.type ?? "SALES_COLLATERAL", brief: body.brief ?? "" }
    );
    return NextResponse.json(out, { status: 202 }); // queued
  }

  const out = await generateMarketingCollateral({
    tenantId: auth.ctx.tenantId,
    dealId: deal.id,
    templateId: body.templateId ?? "one_pager",
    type: body.type ?? "MARKETING_COLLATERAL",
    data: body.data ?? {},
    brand: body.brand ?? {},
  });
  return NextResponse.json(out, { status: 201 });
}

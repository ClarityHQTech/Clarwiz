import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { listDealDocuments } from "@/lib/mofu/documents";

export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const deal = await prisma.deal.findUnique({
    where: { tenantId_hubspotDealId: { tenantId: auth.ctx.tenantId, hubspotDealId: params.hubspotDealId } },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  const documents = await listDealDocuments({ tenantId: auth.ctx.tenantId, dealId: deal.id });
  return NextResponse.json({ dealId: deal.id, documents });
}

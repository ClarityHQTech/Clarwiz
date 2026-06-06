import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getContactInsight } from "@/lib/mofu/insightsReader";

// GET /api/mofu/deals/:hubspotDealId/contacts/:contactId — derived contact-level view.
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.DEAL_READ });
  if (auth.error) return auth.error;
  const deal = await prisma.deal.findUnique({
    where: { tenantId_hubspotDealId: { tenantId: auth.ctx.tenantId, hubspotDealId: params.hubspotDealId } },
  });
  if (!deal) return NextResponse.json({ ok: false, reason: "deal_not_found" }, { status: 404 });
  const out = await getContactInsight({ tenantId: auth.ctx.tenantId, dealId: deal.id, contactId: params.contactId });
  if (!out.ok) return NextResponse.json(out, { status: 404 });
  return NextResponse.json(out);
}

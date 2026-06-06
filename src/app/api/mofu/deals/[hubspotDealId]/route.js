import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";

// PATCH /api/mofu/deals/:hubspotDealId  { autopilot } — toggle deal autopilot.
export async function PATCH(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_RUN });
  if (auth.error) return auth.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const deal = await prisma.deal.findUnique({
    where: { tenantId_hubspotDealId: { tenantId: auth.ctx.tenantId, hubspotDealId: params.hubspotDealId } },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  const updated = await prisma.deal.update({ where: { id: deal.id }, data: { autopilot: !!body.autopilot } });
  return NextResponse.json({ ok: true, autopilot: updated.autopilot });
}

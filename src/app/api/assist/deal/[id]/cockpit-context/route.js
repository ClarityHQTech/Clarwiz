import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildCockpitDealSnapshot } from "@/lib/assist/cockpit/dealContext";
import { getCachedCockpitRawContext } from "@/lib/assist/cockpit/dealTools";

/**
 * GET /api/assist/deal/[id]/cockpit-context
 * Preloads Cockpit deal context when the deal workroom opens.
 */
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId } = await params;
  if (!dealId) {
    return NextResponse.json({ error: "missing_deal_id" }, { status: 400 });
  }

  await getCachedCockpitRawContext(prisma, ctx.tenantId, dealId);
  const snapshot = await buildCockpitDealSnapshot(prisma, ctx.tenantId, dealId);

  if (snapshot.kind === "empty") {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    dealId,
    dealName: snapshot.deal?.name ?? null,
    companyName: snapshot.company?.name ?? snapshot.scope?.companyName ?? null,
    contactCount: snapshot.contacts?.length ?? 0,
    contactsWithPhone: (snapshot.contacts ?? []).filter((c) => c.phone).length,
    hasIntelligence: Boolean(snapshot.intelligence && !snapshot.intelligence.note),
    signalCount: snapshot.signals?.length ?? 0,
    nbaCount: snapshot.nbas?.length ?? 0,
  });
}

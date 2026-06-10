import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOwnedCampaignDetail } from "@/lib/campaignDetail";
import { syncQualifiedCampaignToCrm } from "@/lib/crm/pushQualifiedToHubspot";

/**
 * POST /api/campaigns/[id]/sync-crm — push any qualified contacts that have
 * not yet been sent to HubSpot. MOFU picks them up on the next Assist sync.
 */
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const campaignId = params.id;

  const campaign = await getOwnedCampaignDetail(campaignId, ctx.tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  try {
    const res = await syncQualifiedCampaignToCrm(prisma, campaignId);

    if (res.total === 0) {
      return NextResponse.json({
        ok: true,
        message: "All qualified contacts are already in HubSpot.",
        ...res,
      });
    }

    return NextResponse.json({
      ok: res.ok,
      message:
        res.synced > 0
          ? `Synced ${res.synced} qualified contact(s) to HubSpot.`
          : res.failed > 0
            ? "Some contacts could not be synced — check HubSpot connection."
            : "Nothing new to sync.",
      ...res,
    });
  } catch (err) {
    console.error(`[CRM] campaign sync failed campaign=${campaignId}: ${err.message}`);
    return NextResponse.json({ ok: false, error: "sync_crm_failed" }, { status: 500 });
  }
}

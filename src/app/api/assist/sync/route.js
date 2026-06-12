import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken, getMofuIntegration } from "@/lib/assist/mofuIntegration";
import { syncCrmGraph } from "@/lib/assist/syncGraph";
import { syncTenantRecordings } from "@/lib/assist/hubspotRecordings";
import { ensureRecordingSetupNbas } from "@/lib/assist/recordingSetupNba";

/**
 * POST /api/assist/sync — hydrate the tenant's CRM graph from HubSpot.
 * 412 if HubSpot is not configured, 401 if the stored token is rejected.
 */
export async function POST() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const token = await getDecryptedHubspotToken(prisma, ctx.tenantId);
    if (!token) {
      console.info(`[MOFU] sync aborted tenant=${ctx.tenantId} reason=not_configured`);
      return NextResponse.json({ error: "mofu_not_configured" }, { status: 412 });
    }

    const integration = await getMofuIntegration(prisma, ctx.tenantId);
    const scopes = integration?.hubspotScopes ?? [];

    const res = await syncCrmGraph(prisma, ctx.tenantId, token);

    if (res.error === "hubspot_auth") {
      console.warn(`[MOFU] sync auth-failed tenant=${ctx.tenantId}`);
      return NextResponse.json({ error: "hubspot_auth" }, { status: 401 });
    }

    const recordings = await syncTenantRecordings(prisma, ctx.tenantId, token, { scopes });
    const setupNbas = await ensureRecordingSetupNbas(prisma, ctx.tenantId);

    console.info(
      `[MOFU] sync ok tenant=${ctx.tenantId} counts=${JSON.stringify(res.counts ?? {})} recordings=${recordings.stored ?? 0}`
    );
    return NextResponse.json({
      ok: true,
      counts: res.counts,
      recordings: {
        stored: recordings.stored,
        transcriptsFetched: recordings.transcriptsFetched,
        transcriptsUnavailable: recordings.transcriptsUnavailable,
        setupNbas,
      },
    });
  } catch (err) {
    console.error(`[MOFU] sync failed tenant=${ctx.tenantId}: ${err.message}`);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}

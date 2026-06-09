import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { syncCrmGraph } from "@/lib/assist/syncGraph";

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

    const res = await syncCrmGraph(prisma, ctx.tenantId, token);

    if (res.error === "hubspot_auth") {
      console.warn(`[MOFU] sync auth-failed tenant=${ctx.tenantId}`);
      return NextResponse.json({ error: "hubspot_auth" }, { status: 401 });
    }

    console.info(
      `[MOFU] sync ok tenant=${ctx.tenantId} counts=${JSON.stringify(res.counts ?? {})}`
    );
    return NextResponse.json({ ok: true, counts: res.counts });
  } catch (err) {
    console.error(`[MOFU] sync failed tenant=${ctx.tenantId}: ${err.message}`);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}

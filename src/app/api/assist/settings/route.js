import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getMofuIntegration,
  upsertMofuIntegration,
  toDisplayConfig,
} from "@/lib/assist/mofuIntegration";
import { verifyHubspotToken } from "@/lib/assist/hubspot";

// MOFU settings are configured before payment gating and managed by tenant admins.
const AUTH = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false };

/** GET — masked integration status for the settings UI. */
export async function GET() {
  const auth = await resolveApiAuth(AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const row = await getMofuIntegration(prisma, ctx.tenantId);
  return NextResponse.json({ integration: toDisplayConfig(row) });
}

/** POST — save (encrypted) HubSpot credentials, run one live verification call. */
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

  const hubspotToken = body?.hubspotToken?.trim();
  if (!hubspotToken) {
    return NextResponse.json(
      { error: "hubspot_token_required" },
      { status: 400 }
    );
  }

  // Verify first (uses the raw token), then persist regardless of the result
  // so the UI can show "test failed" without losing the saved credentials.
  const verification = await verifyHubspotToken(hubspotToken);

  await upsertMofuIntegration(prisma, ctx.tenantId, {
    hubspotToken,
    hubspotPortalId: body?.hubspotPortalId,
    defaultOwnerId: body?.defaultOwnerId,
    insightModel: body?.insightModel,
  });

  const row = await prisma.mofuIntegration.update({
    where: { tenantId: ctx.tenantId },
    data: {
      status: verification.ok ? "connected" : "error",
      connectedAt: verification.ok ? new Date() : null,
    },
  });

  console.info(
    `[MOFU] US-1.1 settings saved tenant=${ctx.tenantId} hubspotVerified=${verification.ok} status=${verification.status}`
  );

  return NextResponse.json({
    success: true,
    verified: { hubspot: verification.ok },
    integration: toDisplayConfig(row),
  });
}

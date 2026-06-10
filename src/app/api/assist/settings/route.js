import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getMofuIntegration,
  isHubspotOAuthConnected,
  toDisplayConfig,
} from "@/lib/assist/mofuIntegration";

// MOFU settings are configured before payment gating and managed by tenant admins.
const AUTH = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false };

/** GET — integration status for the settings UI. */
export async function GET() {
  const auth = await resolveApiAuth(AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const row = await getMofuIntegration(prisma, ctx.tenantId);
  return NextResponse.json({ integration: toDisplayConfig(row) });
}

/** POST — update OAuth-connected integration settings (e.g. Single Send email ID). */
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

  const existing = await getMofuIntegration(prisma, ctx.tenantId);
  if (!existing) {
    return NextResponse.json({ error: "not_configured" }, { status: 400 });
  }

  if (body?.singleSendEmailId === undefined) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const raw = body.singleSendEmailId;
  const row = await prisma.mofuIntegration.update({
    where: { tenantId: ctx.tenantId },
    data: { hubspotSingleSendEmailId: raw ? String(raw).trim() || null : null },
  });

  return NextResponse.json({
    success: true,
    verified: { hubspot: isHubspotOAuthConnected(existing) },
    integration: toDisplayConfig(row),
  });
}

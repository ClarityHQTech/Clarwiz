import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getMofuIntegration,
  isHubspotOAuthConnected,
  toDisplayConfig,
} from "@/lib/assist/mofuIntegration";
import { getCalendlyIntegration } from "@/lib/calendlyIntegration";

// MOFU settings are configured before payment gating and managed by tenant admins.
const AUTH = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false };

function validateCalendlyUrl(raw) {
  const url = raw?.trim() || null;
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    return { error: "Calendly URL must start with http:// or https://" };
  }
  return { url };
}

/** GET — integration status for the settings UI. */
export async function GET() {
  const auth = await resolveApiAuth(AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const [row, calendly] = await Promise.all([
    getMofuIntegration(prisma, ctx.tenantId),
    getCalendlyIntegration(ctx.tenantId).catch(() => null),
  ]);

  return NextResponse.json({
    integration: toDisplayConfig(row),
    calendlyConnected: calendly?.status === "connected",
  });
}

/** POST — update AE Assist settings (Single Send email ID, Calendly booking URL). */
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

  const data = {};

  if (body?.singleSendEmailId !== undefined) {
    const raw = body.singleSendEmailId;
    data.hubspotSingleSendEmailId = raw ? String(raw).trim() || null : null;
  }

  if (body?.calendlyBookingUrl !== undefined) {
    const parsed = validateCalendlyUrl(body.calendlyBookingUrl);
    if (parsed?.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    data.calendlyBookingUrl = parsed.url;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const existing = await getMofuIntegration(prisma, ctx.tenantId);
  const row = existing
    ? await prisma.mofuIntegration.update({
        where: { tenantId: ctx.tenantId },
        data,
      })
    : await prisma.mofuIntegration.create({
        data: { tenantId: ctx.tenantId, ...data },
      });

  return NextResponse.json({
    success: true,
    verified: { hubspot: isHubspotOAuthConnected(existing ?? row) },
    integration: toDisplayConfig(row),
  });
}

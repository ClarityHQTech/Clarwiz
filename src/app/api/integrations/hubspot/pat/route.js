import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { connectHubSpotFromPat } from "@/lib/hubspot/hubspotIntegration";

// POST /api/integrations/hubspot/pat  { token: "pat-...", portalId?: "..." }
// Phase A HubSpot connect path: stores a Private App token for the active tenant.
export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.token?.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const row = await connectHubSpotFromPat(auth.ctx.tenantId, body.token, {
    portalId: body.portalId ?? null,
  });
  return NextResponse.json({ ok: true, status: row.status, portalId: row.portalId });
}

import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  disconnectCalendly,
  getCalendlyIntegration,
} from "@/lib/calendlyIntegration";

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const integration = await getCalendlyIntegration(ctx.tenantId);
  return NextResponse.json({ integration });
}

export async function DELETE() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    await disconnectCalendly(ctx.tenantId);
    return NextResponse.json({ integration: null });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to disconnect Calendly" },
      { status: 500 }
    );
  }
}

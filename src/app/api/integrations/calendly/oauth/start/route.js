import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  buildCalendlyAuthorizeUrl,
  CALENDLY_CONNECTION_MODES,
  normalizeCalendlyConnectionMode,
} from "@/lib/calendlyApi";
import { createOAuthState } from "@/lib/oauthState";

export async function GET(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(request.url);
  const mode = normalizeCalendlyConnectionMode(
    searchParams.get("mode") || CALENDLY_CONNECTION_MODES.WEBHOOKS
  );

  try {
    const state = createOAuthState(ctx.tenantId, "calendly", { connectionMode: mode });
    const url = buildCalendlyAuthorizeUrl(state, mode);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Calendly OAuth is not configured" },
      { status: 500 }
    );
  }
}

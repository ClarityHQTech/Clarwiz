import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appUrl";
import {
  CALENDLY_CONNECTION_MODES,
  normalizeCalendlyConnectionMode,
} from "@/lib/calendlyApi";
import { connectCalendlyFromOAuth } from "@/lib/calendlyIntegration";
import { verifyOAuthState } from "@/lib/oauthState";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = `${getAppBaseUrl()}/settings?calendly=`;

  if (error) {
    return NextResponse.redirect(`${settingsUrl}error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}error&reason=missing_code`);
  }

  const payload = verifyOAuthState(state, "calendly");
  const tenantId = payload?.tenantId ?? payload?.userId;
  if (!tenantId) {
    return NextResponse.redirect(`${settingsUrl}error&reason=invalid_state`);
  }

  const connectionMode = normalizeCalendlyConnectionMode(payload.connectionMode);

  try {
    await connectCalendlyFromOAuth(tenantId, code, connectionMode);
    const connectedParam =
      connectionMode === CALENDLY_CONNECTION_MODES.WEBHOOKS
        ? "connected"
        : "connected_booking_link";
    return NextResponse.redirect(`${settingsUrl}${connectedParam}`);
  } catch (err) {
    console.error("[calendly oauth callback]", err);
    return NextResponse.redirect(
      `${settingsUrl}error&reason=${encodeURIComponent(err.message || "connect_failed")}`
    );
  }
}

import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appUrl";
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
  if (!payload?.userId) {
    return NextResponse.redirect(`${settingsUrl}error&reason=invalid_state`);
  }

  try {
    await connectCalendlyFromOAuth(payload.userId, code);
    return NextResponse.redirect(`${settingsUrl}connected`);
  } catch (err) {
    console.error("[calendly oauth callback]", err);
    return NextResponse.redirect(
      `${settingsUrl}error&reason=${encodeURIComponent(err.message || "connect_failed")}`
    );
  }
}

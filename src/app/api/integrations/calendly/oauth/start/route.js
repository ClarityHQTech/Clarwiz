import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import {
  buildCalendlyAuthorizeUrl,
  CALENDLY_CONNECTION_MODES,
  normalizeCalendlyConnectionMode,
} from "@/lib/calendlyApi";
import { createOAuthState } from "@/lib/oauthState";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.payment) {
    return NextResponse.json(
      { error: "Forbidden", message: "You don't have access to this." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const mode = normalizeCalendlyConnectionMode(
    searchParams.get("mode") || CALENDLY_CONNECTION_MODES.WEBHOOKS
  );

  try {
    const state = createOAuthState(user.id, "calendly", { connectionMode: mode });
    const url = buildCalendlyAuthorizeUrl(state, mode);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Calendly OAuth is not configured" },
      { status: 500 }
    );
  }
}

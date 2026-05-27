import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { buildCalendlyAuthorizeUrl } from "@/lib/calendlyApi";
import { createOAuthState } from "@/lib/oauthState";

export async function GET() {
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

  try {
    const state = createOAuthState(user.id, "calendly");
    const url = buildCalendlyAuthorizeUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Calendly OAuth is not configured" },
      { status: 500 }
    );
  }
}

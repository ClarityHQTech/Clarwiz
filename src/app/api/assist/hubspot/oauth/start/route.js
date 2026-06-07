import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { createOAuthState } from "@/lib/oauthState";

/**
 * Begin the HubSpot OAuth install flow. Tenant admins only.
 * Redirects the browser to HubSpot's authorize screen with an HMAC-signed
 * state carrying the tenantId (verified on the callback).
 */
export async function GET() {
  const auth = await resolveApiAuth({
    permission: PERMISSIONS.ASSIST_VIEW,
    requirePaid: false,
    tenantAdmin: true,
  });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
    const scopes = process.env.HUBSPOT_OAUTH_SCOPES;
    const optionalScopes = process.env.HUBSPOT_OAUTH_OPTIONAL_SCOPES;
    if (!clientId || !redirectUri || !scopes) {
      throw new Error("HubSpot OAuth is not configured");
    }

    const state = createOAuthState(ctx.tenantId, "hubspot");
    let url =
      "https://app.hubspot.com/oauth/authorize" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}`;
    // Optional scopes are granted only on portals that have them — keeps the
    // install from failing on tiers that lack premium add-ons. Must match the
    // app's configured "Optional scopes".
    if (optionalScopes && optionalScopes.trim()) {
      url += `&optional_scope=${encodeURIComponent(optionalScopes)}`;
    }
    url += `&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "HubSpot OAuth is not configured" },
      { status: 500 }
    );
  }
}

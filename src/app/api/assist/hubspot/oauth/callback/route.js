import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/appUrl";
import { verifyOAuthState } from "@/lib/oauthState";
import {
  buildTokenExchangeBody,
  upsertHubspotOAuth,
} from "@/lib/assist/mofuIntegration";

const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_TOKEN_INFO_URL = "https://api.hubapi.com/oauth/v1/access-tokens";

function redirect(status) {
  return NextResponse.redirect(`${getAppBaseUrl()}/assist/settings?hubspot=${status}`);
}

/**
 * HubSpot OAuth callback. Exchanges the authorization code for tokens, looks up
 * portal id + granted scopes, and persists the OAuth grant for the tenant.
 *
 * Always redirects to /assist/settings with a ?hubspot= status — never 500s to
 * the browser and never leaks the client secret.
 */
export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const error = params.get("error") || params.get("error_description");
  if (error) {
    console.warn("[MOFU] HubSpot OAuth denied:", error);
    return redirect("denied");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return redirect("badstate");
  }

  const payload = verifyOAuthState(state, "hubspot");
  const tenantId = payload?.tenantId;
  if (!tenantId) {
    return redirect("badstate");
  }

  try {
    // 1. Exchange the auth code for access + refresh tokens.
    const tokenRes = await fetch(HUBSPOT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildTokenExchangeBody({ code }),
    });
    if (!tokenRes.ok) {
      console.warn("[MOFU] HubSpot code exchange failed with status", tokenRes.status);
      return redirect("error");
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.warn("[MOFU] HubSpot code exchange returned no access_token");
      return redirect("error");
    }

    // 2. Look up portal id + granted scopes from the token info endpoint.
    let portalId = null;
    let scopes = [];
    try {
      const infoRes = await fetch(
        `${HUBSPOT_TOKEN_INFO_URL}/${encodeURIComponent(accessToken)}`
      );
      if (infoRes.ok) {
        const info = await infoRes.json();
        portalId = info.hub_id != null ? String(info.hub_id) : null;
        scopes = Array.isArray(info.scopes) ? info.scopes : [];
      } else {
        console.warn("[MOFU] HubSpot token info lookup failed with status", infoRes.status);
      }
    } catch (infoErr) {
      console.warn("[MOFU] HubSpot token info lookup error:", infoErr.message);
    }

    // 3. Persist the OAuth grant.
    await upsertHubspotOAuth(prisma, tenantId, {
      accessToken,
      refreshToken: tokenData.refresh_token ?? null,
      expiresIn: tokenData.expires_in,
      portalId,
      scopes,
    });

    console.log(
      `[MOFU] HubSpot OAuth connected for tenant ${tenantId} (portal ${portalId ?? "unknown"}, ${scopes.length} scopes)`
    );
    return redirect("connected");
  } catch (err) {
    console.warn("[MOFU] HubSpot OAuth callback error:", err.message);
    return redirect("error");
  }
}

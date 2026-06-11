import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/appUrl";
import { verifyOAuthState } from "@/lib/oauthState";
import { exchangeGmailCode, upsertGmailOAuth } from "@/lib/gmail/gmailIntegration";

function redirect(status, returnTo = "assist_settings") {
  const path = returnTo === "integrations" ? "/integrations" : "/assist/settings";
  return NextResponse.redirect(`${getAppBaseUrl()}${path}?gmail=${status}`);
}

export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  if (error) {
    console.warn("[Gmail] OAuth denied:", error);
    return redirect("denied", "assist_settings");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return redirect("badstate", "assist_settings");
  }

  const payload = verifyOAuthState(state, "gmail");
  const tenantId = payload?.tenantId;
  const userId = payload?.userId;
  const returnTo = payload?.returnTo === "integrations" ? "integrations" : "assist_settings";
  if (!tenantId || !userId) {
    return redirect("badstate", returnTo);
  }

  try {
    const tokens = await exchangeGmailCode(code);
    if (!tokens.ok || !tokens.access_token) {
      console.warn("[Gmail] code exchange failed", tokens.status);
      return redirect("error", returnTo);
    }
    await upsertGmailOAuth(prisma, {
      tenantId,
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresIn: tokens.expires_in,
    });
    return redirect("connected", returnTo);
  } catch (err) {
    console.error("[Gmail] callback failed:", err.message);
    return redirect("error", returnTo);
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/appUrl";
import { verifyOAuthState } from "@/lib/oauthState";
import { exchangeGmailCode, upsertGmailOAuth } from "@/lib/gmail/gmailIntegration";

function redirect(status) {
  return NextResponse.redirect(`${getAppBaseUrl()}/assist/settings?gmail=${status}`);
}

export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  if (error) {
    console.warn("[Gmail] OAuth denied:", error);
    return redirect("denied");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return redirect("badstate");
  }

  const payload = verifyOAuthState(state, "gmail");
  const tenantId = payload?.tenantId;
  const userId = payload?.userId;
  if (!tenantId || !userId) {
    return redirect("badstate");
  }

  try {
    const tokens = await exchangeGmailCode(code);
    if (!tokens.ok || !tokens.access_token) {
      console.warn("[Gmail] code exchange failed", tokens.status);
      return redirect("error");
    }
    await upsertGmailOAuth(prisma, {
      tenantId,
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresIn: tokens.expires_in,
    });
    return redirect("connected");
  } catch (err) {
    console.error("[Gmail] callback failed:", err.message);
    return redirect("error");
  }
}

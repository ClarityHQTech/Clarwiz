import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauthState";
import { buildGmailAuthorizeUrl } from "@/lib/gmail/gmailOAuth";
import { resolveGmailConnectAuth } from "@/lib/gmail/gmailConnectAuth";

/** Begin Gmail OAuth for the signed-in user (per-user send mailbox). */
export async function GET() {
  const auth = await resolveGmailConnectAuth();
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const state = createOAuthState(ctx.tenantId, "gmail", { userId: ctx.user.id });
    return NextResponse.redirect(buildGmailAuthorizeUrl(state));
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gmail OAuth is not configured" },
      { status: 500 }
    );
  }
}

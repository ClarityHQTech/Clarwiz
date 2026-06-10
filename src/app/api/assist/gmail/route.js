import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  disconnectGmail,
  getUserGmailConnection,
  toGmailDisplayConfig,
} from "@/lib/gmail/gmailIntegration";
import { resolveGmailConnectAuth } from "@/lib/gmail/gmailConnectAuth";

const VIEW_AUTH = { permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false };

/** GET — current user's Gmail connection for this tenant. */
export async function GET() {
  const auth = await resolveApiAuth(VIEW_AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (!ctx.user?.id) {
    return NextResponse.json({ gmail: { connected: false } });
  }

  const row = await getUserGmailConnection(prisma, ctx.tenantId, ctx.user.id);
  return NextResponse.json({ gmail: toGmailDisplayConfig(row) });
}

/** DELETE — disconnect current user's Gmail. */
export async function DELETE() {
  const auth = await resolveGmailConnectAuth();
  if (auth.error) return auth.error;
  const { ctx } = auth;

  await disconnectGmail(prisma, ctx.tenantId, ctx.user.id);
  return NextResponse.json({ ok: true });
}

import { resolveApiAuth } from "@/lib/apiAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

/**
 * Gmail connect is per-user: tenant admins, members with channel integrate,
 * or members with NBA execute permission may connect their own mailbox.
 */
export async function resolveGmailConnectAuth() {
  const auth = await resolveApiAuth({ requirePaid: false });
  if (auth.error) return auth;

  const { ctx } = auth;
  const canConnect =
    ctx.tenantRole === "ADMIN" ||
    hasPermission(ctx, PERMISSIONS.CHANNEL_INTEGRATE) ||
    hasPermission(ctx, PERMISSIONS.NBA_EXECUTE) ||
    hasPermission(ctx, PERMISSIONS.HUBSPOT_WRITE);

  if (!canConnect) {
    const { NextResponse } = await import("next/server");
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  if (!ctx.user?.id) {
    const { NextResponse } = await import("next/server");
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  return { ctx };
}

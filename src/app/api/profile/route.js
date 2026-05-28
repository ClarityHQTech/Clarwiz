import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authContext";
import { requireAuth } from "@/lib/requireAuth";
import { hasPermission, PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const ctx = await getAuthContext();
  const authErr = requireAuth(ctx);
  if (authErr) return authErr;

  const effectivePermissions =
    ctx.isSuperadmin || ctx.tenantRole === "ADMIN"
      ? ALL_PERMISSIONS
      : ctx.scopes || [];

  return NextResponse.json({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    image: ctx.user.image,
    isSuperadmin: ctx.isSuperadmin,
    tenantRole: ctx.tenantRole,
    tenantId: ctx.tenantId,
    tenantName: ctx.tenant?.name ?? null,
    payment_status: ctx.isTenantActive,
    scopes: effectivePermissions,
    needsTenantSelection: ctx.needsTenantSelection,
    memberships: ctx.memberships,
    canManageTeam: hasPermission(ctx, PERMISSIONS.MEMBER_MANAGE),
    canAccessChannelIntegration: hasPermission(ctx, PERMISSIONS.CHANNEL_INTEGRATE),
    canAccessCampaignCreate: hasPermission(ctx, PERMISSIONS.CAMPAIGN_CREATE),
    canAccessCampaignManage: hasPermission(ctx, PERMISSIONS.CAMPAIGN_MANAGE),
    canAccessIcpCall: hasPermission(ctx, PERMISSIONS.ICP_CALL),
  });
}

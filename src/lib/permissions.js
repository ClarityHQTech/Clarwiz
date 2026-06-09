export const PERMISSIONS = {
  CAMPAIGN_CREATE: "campaign:create",
  CAMPAIGN_MANAGE: "campaign:manage",
  CHANNEL_INTEGRATE: "channel:integrate",
  ICP_CALL: "icp:call",
  MEMBER_MANAGE: "member:manage",
  // MOFU (AE Assist) layer
  ASSIST_VIEW: "assist:view",
  DEAL_READ: "deal:read",
  INSIGHT_RUN: "insight:run",
  NBA_EXECUTE: "nba:execute",
  COLLATERAL_MANAGE: "collateral:manage",
  HUBSPOT_WRITE: "hubspot:write",
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export function hasPermission(ctx, permission) {
  if (!ctx) return false;
  if (ctx.isSuperadmin) return true;
  if (ctx.tenantRole === "ADMIN") return true;
  if (ctx.tenantRole === "MEMBER") {
    return (ctx.scopes || []).includes(permission);
  }
  return false;
}

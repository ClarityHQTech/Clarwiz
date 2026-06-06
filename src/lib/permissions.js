export const PERMISSIONS = {
  CAMPAIGN_CREATE: "campaign:create",
  CAMPAIGN_MANAGE: "campaign:manage",
  CHANNEL_INTEGRATE: "channel:integrate",
  ICP_CALL: "icp:call",
  MEMBER_MANAGE: "member:manage",
  // MOFU (deal-centric NBA) scopes
  MOFU_VIEW: "mofu:view",
  DEAL_READ: "deal:read",
  NBA_RUN: "nba:run",
  NBA_APPROVE: "nba:approve",
  COLLATERAL_GENERATE: "collateral:generate",
  OPERATOR_DASHBOARD: "operator:dashboard",
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

import { describe, it, expect } from "vitest";
import { PERMISSIONS, hasPermission } from "./permissions.js";

describe("MOFU RBAC scopes", () => {
  it("defines the MOFU permission constants in domain:action form", () => {
    expect(PERMISSIONS.ASSIST_VIEW).toBe("assist:view");
    expect(PERMISSIONS.DEAL_READ).toBe("deal:read");
    expect(PERMISSIONS.INSIGHT_RUN).toBe("insight:run");
    expect(PERMISSIONS.NBA_EXECUTE).toBe("nba:execute");
    expect(PERMISSIONS.COLLATERAL_MANAGE).toBe("collateral:manage");
    expect(PERMISSIONS.HUBSPOT_WRITE).toBe("hubspot:write");
  });

  it("grants a MEMBER a MOFU scope they hold, denies one they lack", () => {
    const ctx = { tenantRole: "MEMBER", scopes: ["assist:view"] };
    expect(hasPermission(ctx, PERMISSIONS.ASSIST_VIEW)).toBe(true);
    expect(hasPermission(ctx, PERMISSIONS.NBA_EXECUTE)).toBe(false);
  });
});

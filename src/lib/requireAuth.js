import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse(message = "You don't have access to this.") {
  return NextResponse.json(
    { error: "Forbidden", message },
    { status: 403 }
  );
}

export function tenantRequiredResponse() {
  return NextResponse.json(
    {
      error: "TenantRequired",
      message: "Select a workspace to continue.",
      needsTenantSelection: true,
    },
    { status: 428 }
  );
}

export function requireAuth(ctx) {
  if (!ctx?.user) return unauthorizedResponse();
  return null;
}

export function requireTenant(ctx) {
  const authErr = requireAuth(ctx);
  if (authErr) return authErr;
  if (!ctx.tenantId) return tenantRequiredResponse();
  return null;
}

export function requirePayment(ctx) {
  const tenantErr = requireTenant(ctx);
  if (tenantErr) return tenantErr;
  if (!ctx.isTenantActive) {
    return NextResponse.json(
      { error: "PaymentRequired", message: "This workspace requires active payment." },
      { status: 402 }
    );
  }
  return null;
}

export function requireTenantRole(ctx, role) {
  const paymentErr = requirePayment(ctx);
  if (paymentErr) return paymentErr;
  if (ctx.isSuperadmin) return null;
  if (ctx.tenantRole !== role) {
    return forbiddenResponse("Admin access required.");
  }
  return null;
}

export function requireSuperAdmin(ctx) {
  const authErr = requireAuth(ctx);
  if (authErr) return authErr;
  if (!ctx.isSuperadmin) {
    return forbiddenResponse("Super admin access required.");
  }
  return null;
}

export function requirePermission(ctx, permission) {
  const paymentErr = requirePayment(ctx);
  if (paymentErr) return paymentErr;
  if (!hasPermission(ctx, permission)) {
    return forbiddenResponse("You do not have permission for this action.");
  }
  return null;
}

import { getAuthContext } from "@/lib/authContext";
import { requirePayment, requirePermission, requireTenantRole } from "@/lib/requireAuth";

/**
 * Resolve auth context and run guards. Returns { ctx } or { error: NextResponse }.
 */
export async function resolveApiAuth({
  permission = null,
  requirePaid = true,
  tenantAdmin = false,
} = {}) {
  const ctx = await getAuthContext();
  if (requirePaid) {
    const payErr = requirePayment(ctx);
    if (payErr) return { error: payErr };
  } else {
    const { requireTenant, requireAuth } = await import("@/lib/requireAuth");
    const authErr = requireAuth(ctx);
    if (authErr) return { error: authErr };
    const tenantErr = requireTenant(ctx);
    if (tenantErr) return { error: tenantErr };
  }
  if (tenantAdmin) {
    const roleErr = requireTenantRole(ctx, "ADMIN");
    if (roleErr) return { error: roleErr };
  }
  if (permission) {
    const permErr = requirePermission(ctx, permission);
    if (permErr) return { error: permErr };
  }
  return { ctx };
}

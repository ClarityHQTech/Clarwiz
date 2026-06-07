import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authContext";
import { prisma } from "@/lib/prisma";
import { recentAssistActions } from "@/lib/assist/logAction";
import ActivityLogClient from "@/components/assist/log/ActivityLogClient";

/**
 * Activity Log (server component). Reads the tenant's append-only assist action
 * feed and hands serializable rows to the client. Mirrors the dashboard's
 * auth/tenant gating.
 */
export default async function ActivityLogPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/dashboard");
  if (!ctx.tenantId) redirect("/assist");

  const rows = await recentAssistActions(prisma, ctx.tenantId, 200);
  const actions = rows.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entityType ?? null,
    hsObjectId: a.hsObjectId ?? null,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  }));

  return <ActivityLogClient actions={actions} />;
}

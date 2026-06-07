import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authContext";
import { prisma } from "@/lib/prisma";
import { getMofuIntegration } from "@/lib/assist/mofuIntegration";
import { getDashboardData } from "@/lib/assist/insightsReader";
import { recentAssistActions } from "@/lib/assist/logAction";
import DashboardClient from "@/components/assist/dashboard/DashboardClient";
import AssistNotice from "@/components/assist/dashboard/AssistNotice";

/**
 * AE Assist dashboard (server component). Resolves the authenticated tenant via
 * getAuthContext(), then reads the hydrated CRM graph + recent activity straight
 * from Prisma and hands a serializable view-model to the client shell.
 */
export default async function DashboardPage() {
  const ctx = await getAuthContext();

  // No session at all → bounce to the app dashboard (which gates auth).
  if (!ctx) redirect("/dashboard");

  // Authenticated but no active workspace selected.
  if (!ctx.tenantId) {
    return (
      <AssistNotice
        icon="alert"
        title="No active workspace"
        message="Pick a workspace to use AE Assist. You can switch workspaces from your profile."
        ctaLabel="Go to dashboard"
        ctaHref="/dashboard"
      />
    );
  }

  // MOFU/HubSpot not configured yet → guide the AE to Settings.
  const integration = await getMofuIntegration(prisma, ctx.tenantId);
  if (!integration?.encryptedHubspotToken) {
    return (
      <AssistNotice
        icon="link"
        title="Connect HubSpot to get started"
        message="AE Assist reads your deals, leads and companies from HubSpot. Add your private-app token in Settings to hydrate your CRM graph."
        ctaLabel="Connect HubSpot in Settings"
        ctaHref="/assist/settings"
      />
    );
  }

  const [data, actions] = await Promise.all([
    getDashboardData(prisma, ctx.tenantId),
    recentAssistActions(prisma, ctx.tenantId, 12),
  ]);

  return <DashboardClient data={data} actions={actions} />;
}

import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authContext";
import { prisma } from "@/lib/prisma";
import {
  getMofuIntegration,
  getDecryptedHubspotToken,
  isHubspotOAuthConnected,
} from "@/lib/assist/mofuIntegration";
import { resolveOwnerIdByEmail } from "@/lib/assist/hubspot";
import { getDashboardData } from "@/lib/assist/insightsReader";
import { recentAssistActions } from "@/lib/assist/logAction";
import DashboardClient from "@/components/assist/dashboard/DashboardClient";
import AssistNotice from "@/components/assist/dashboard/AssistNotice";

/**
 * AE Assist dashboard (server component). Resolves the authenticated tenant via
 * getAuthContext(), then reads the hydrated CRM graph + recent activity straight
 * from Prisma and hands a serializable view-model to the client shell.
 */
export default async function DashboardPage({ searchParams }) {
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

  // MOFU/HubSpot not connected yet → guide the AE to Integrations.
  const integration = await getMofuIntegration(prisma, ctx.tenantId);
  if (!isHubspotOAuthConnected(integration)) {
    return (
      <AssistNotice
        icon="link"
        title="Connect HubSpot to get started"
        message="AE Assist reads your deals, leads and companies from HubSpot. Connect your portal in Integrations to hydrate your CRM graph."
        ctaLabel="Connect HubSpot"
        ctaHref="/integrations"
      />
    );
  }

  // "My book" (default) vs "All" portal view. ?owner=all opts out of scoping.
  const sp = await searchParams;
  const requested = sp?.owner === "all" ? "all" : "mine";

  // Resolve the signed-in AE's hubspot_owner_id once per load. Null when the
  // owners scope isn't granted yet, the user isn't a HubSpot owner, or we're not
  // OAuth-connected — in which case we fall back to All with a subtle note.
  let ownerId = null;
  let ownerNote = null;
  if (requested === "mine") {
    const token = await getDecryptedHubspotToken(prisma, ctx.tenantId);
    ownerId = token ? await resolveOwnerIdByEmail(token, ctx.user.email) : null;
    if (!ownerId) {
      ownerNote = "Connect with owner access to filter to your book.";
    }
  }

  // Effective view: "mine" only stands if we actually resolved an owner id.
  const view = ownerId ? "mine" : "all";

  const [data, actions] = await Promise.all([
    getDashboardData(prisma, ctx.tenantId, { ownerId }),
    recentAssistActions(prisma, ctx.tenantId, 200),
  ]);

  return <DashboardClient data={data} actions={actions} view={view} ownerNote={ownerNote} />;
}

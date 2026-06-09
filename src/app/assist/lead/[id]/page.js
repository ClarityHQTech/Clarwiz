import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { getLeadView } from "@/lib/assist/insightsReader";
import { getTofuTimeline } from "@/lib/assist/tofuTimeline";
import LeadWorkroomClient from "@/components/assist/lead/LeadWorkroomClient";

/**
 * Lead Workroom (L1) — the MQL workspace. Server component: resolves the tenant,
 * reads the lead view + the optional TOFU outreach timeline (Mode-3 enrichment),
 * and hands serializable data to the client shell.
 *
 * Composability: the TOFU timeline is enrichment only — a tenant with zero TOFU
 * data still gets a fully functional workroom ("No Clarwiz outreach history").
 */
export default async function LeadWorkroomPage({ params }) {
  const { id } = await params;

  const ctx = await getAuthContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) notFound();

  const view = await getLeadView(prisma, tenantId, id);
  if (!view) notFound();

  const { businessUser, company } = view;
  const timeline = await getTofuTimeline(prisma, tenantId, businessUser?.email);
  const companyName = company?.name || businessUser?.company?.name || null;
  const leadName =
    businessUser?.name ||
    [businessUser?.firstName, businessUser?.lastName].filter(Boolean).join(" ") ||
    "Lead";

  return (
    <LeadWorkroomClient view={view} timeline={timeline} companyName={companyName} leadName={leadName} />
  );
}

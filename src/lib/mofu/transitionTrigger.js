import { transitionToOpportunity } from "@/lib/mofu/transition";

/**
 * Additive TOFU->MOFU transition trigger fired after qualification. No-op unless
 * CLARWIZ_AUTO_TRANSITION=1, and ALWAYS best-effort (never throws into the TOFU
 * qualification path). This is the single additive hook into TOFU per the kickoff.
 */
export async function fireTransitionOnQualification(prismaClient, { contactCampaign, tenantId }) {
  if (process.env.CLARWIZ_AUTO_TRANSITION !== "1") return { skipped: true, reason: "disabled" };
  if (!contactCampaign?.id || !tenantId) return { skipped: true, reason: "insufficient_context" };
  try {
    const cc = await prismaClient.contactCampaign.findUnique({
      where: { id: contactCampaign.id },
      include: { contact: { include: { businessUser: { include: { company: true } } } } },
    });
    const bu = cc?.contact?.businessUser;
    if (!cc) return { skipped: true, reason: "insufficient_context" };
    return await transitionToOpportunity({
      tenantId,
      source: "TOFU_TRANSITION",
      contactCampaignId: cc.id,
      clarwizContactId: cc.contactId,
      company: { name: bu?.company?.name ?? bu?.name ?? "Unknown", domain: bu?.company?.domain ?? null },
      contact: { email: bu?.email, firstName: bu?.firstName, lastName: bu?.lastName },
      dealName: `${bu?.company?.name ?? bu?.name ?? "New"} — opportunity`,
    });
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

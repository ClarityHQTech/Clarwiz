import { prisma } from "@/lib/prisma";

/** Autopilot only — copilot campaigns record webhook events but do not auto-send. */
export async function shouldAutoExecuteOnWebhook(campaignId) {
  if (!campaignId) return false;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  return campaign?.status === "active";
}

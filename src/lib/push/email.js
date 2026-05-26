import { sendPlannedEmailViaSmartlead } from "@/lib/smartleadOutreach";
import { buildPushResult, buildSkippedPush } from "@/lib/push/normalizePushResult";

/**
 * Send a planned email via Smartlead (campaign lead or thread reply).
 * Used by the execution layer when channel === "email".
 */
export async function pushEmail({
  campaign,
  prospect,
  subject,
  message,
  commHistory = [],
}) {
  if (!prospect.email?.trim()) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: "smartlead",
      deliveryMeta: { error: "Prospect has no email address" },
      error: `Prospect ${prospect.name} has no email address`,
    });
  }

  try {
    const delivery = await sendPlannedEmailViaSmartlead({
      campaign,
      prospect,
      subject,
      message,
      commHistory,
    });

    return buildPushResult({
      status: delivery.status,
      deliveryProvider: delivery.deliveryProvider,
      deliveryMeta: delivery.deliveryMeta,
      deliveryMessage: delivery.deliveryMessage,
    });
  } catch (err) {
    return buildPushResult({
      status: "failed",
      deliveryProvider: "smartlead",
      deliveryMeta: { error: err.message, sendFailed: true },
      error: err.message,
    });
  }
}

/** Returns skipped result when Smartlead inbox is not connected (no throw). */
export async function pushEmailIfConnected({
  campaign,
  prospect,
  subject,
  message,
  commHistory = [],
}) {
  const { getEmailIntegration } = await import("@/lib/emailIntegration");
  const integration = await getEmailIntegration(campaign.userId);
  const canSend =
    integration?.mode === "smartlead_inbox" &&
    integration?.status === "connected" &&
    integration?.hasSmartleadAccount;

  if (!canSend) {
    return buildSkippedPush("smartlead_not_connected", "smartlead");
  }

  return pushEmail({ campaign, prospect, subject, message, commHistory });
}

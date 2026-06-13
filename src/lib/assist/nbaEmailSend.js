/**
 * Deliver an NBA email: Gmail (user's mailbox) → HubSpot Single Send → timeline log only.
 * Always logs the email on the HubSpot deal/contact timeline when HubSpot is configured.
 */
import { getDecryptedHubspotToken, getMofuIntegration } from "@/lib/assist/mofuIntegration";
import { logEmailEngagement, associateEmailTo, sendSingleSendEmail } from "@/lib/assist/hubspotWrite";
import { getGmailAccessToken } from "@/lib/gmail/gmailIntegration";
import { sendGmailMessage } from "@/lib/gmail/gmailSend";
import { embedCollateralInline } from "@/lib/assist/nbaEmailCollateral";

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|null} params.userId - current AE (for Gmail send-as)
 * @param {string} params.hubspotDealId
 * @param {string} params.subject
 * @param {string} params.html
 * @param {string[]} params.recipientEmails
 * @param {string[]} params.recipientContactIds - HubSpot contact ids
 * @param {Array<{ filename: string, content: string, mimeType?: string }>} [params.attachments]
 * @param {string} [params.collateralTitle] - label when inlining collateral for Single Send
 */
export async function deliverNbaEmail(
  prisma,
  {
    tenantId,
    userId,
    hubspotDealId,
    subject,
    html,
    recipientEmails,
    recipientContactIds,
    attachments = [],
    collateralTitle = null,
  },
  { fetchImpl = fetch } = {}
) {
  const emailAttachments = Array.isArray(attachments) ? attachments.filter((a) => a?.content) : [];
  const collateralFile = emailAttachments[0] ?? null;
  const isHtmlCollateral =
    collateralFile &&
    (collateralFile.mimeType || "").toLowerCase().includes("html");
  const singleSendHtml = isHtmlCollateral
    ? embedCollateralInline(html, collateralFile.content, collateralTitle || collateralFile.filename)
    : html;
  let delivered = false;
  let loggedHtml = html;
  let sentCount = 0;
  let failedCount = 0;
  let deliveryChannel = null;
  let deliverReason = null;

  // ── 1) Gmail (connected user mailbox) ─────────────────────────────────────
  if (userId && recipientEmails.length) {
    const gmail = await getGmailAccessToken(prisma, tenantId, userId, { fetchImpl });
    if (gmail?.accessToken && gmail.email) {
      for (const to of recipientEmails) {
        const r = await sendGmailMessage(
          gmail.accessToken,
          { from: gmail.email, to, subject, html, attachments: emailAttachments },
          { fetchImpl }
        );
        if (r.ok) {
          sentCount += 1;
          deliveryChannel = "gmail";
        } else {
          failedCount += 1;
        }
      }
      delivered = sentCount > 0;
      if (!delivered && failedCount > 0) {
        deliverReason = "gmail_send_failed";
      }
    }
  }

  // ── 2) HubSpot Single Send fallback (tenant-level) ────────────────────────
  if (!delivered) {
    const integration = await getMofuIntegration(prisma, tenantId);
    const singleSendEmailId = integration?.hubspotSingleSendEmailId || null;
    if (singleSendEmailId && recipientEmails.length) {
      const hubspotToken = await getDecryptedHubspotToken(prisma, tenantId, { fetchImpl });
      if (hubspotToken) {
        let forbiddenCount = 0;
        for (const to of recipientEmails) {
          const r = await sendSingleSendEmail(
            hubspotToken,
            { emailId: singleSendEmailId, to, subject, html: singleSendHtml },
            { fetchImpl }
          );
          if (r.ok) {
            sentCount += 1;
            deliveryChannel = "hubspot_single_send";
            loggedHtml = singleSendHtml;
          } else {
            failedCount += 1;
            if (r.reason === "write_scope") forbiddenCount += 1;
          }
        }
        delivered = sentCount > 0;
        if (recipientEmails.length > 0 && forbiddenCount === recipientEmails.length) {
          return { ok: false, reason: "write_scope" };
        }
      }
    } else if (!deliverReason) {
      deliverReason = "no_delivery_channel";
    }
  }

  // ── 3) Log on HubSpot timeline (CRM record) ───────────────────────────────
  const hubspotToken = await getDecryptedHubspotToken(prisma, tenantId, { fetchImpl });
  if (!hubspotToken) {
    if (!delivered) {
      return { ok: false, error: "hubspot_not_configured" };
    }
    return {
      ok: true,
      delivered,
      sentCount,
      failedCount,
      deliveryChannel,
      deliverReason,
      hubspotLogged: false,
    };
  }

  const logResult = await logEmailEngagement(
    hubspotToken,
    { dealId: hubspotDealId, contactId: null, subject, html: loggedHtml },
    { fetchImpl }
  );

  if (!logResult.ok) {
    if (logResult.status === 403) {
      return { ok: false, reason: "write_scope", delivered };
    }
    return { ok: false, error: "hubspot_log_failed", status: logResult.status, delivered };
  }

  for (const contactId of recipientContactIds) {
    await associateEmailTo(hubspotToken, logResult.id, "contacts", contactId, { fetchImpl });
  }

  return {
    ok: true,
    delivered,
    sentCount,
    failedCount,
    deliveryChannel,
    deliverReason: delivered ? null : deliverReason,
    hubspotEmailId: logResult.id,
    hubspotLogged: true,
  };
}

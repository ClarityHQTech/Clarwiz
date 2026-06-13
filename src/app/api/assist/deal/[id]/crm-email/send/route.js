import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { deliverNbaEmail } from "@/lib/assist/nbaEmailSend";
import { logAssistAction } from "@/lib/assist/logAction";
import { getCrmEmailCapabilities } from "@/lib/assist/crmEmailCapabilities";
import {
  appendCollateralPdfLinks,
  loadCollateralPdfAttachment,
} from "@/lib/assist/crmEmailCollateral";
import { plainTextToHtml } from "@/lib/assist/plainTextToHtml";

/**
 * POST — send an AE Assist CRM email (not a campaign channel email).
 * Requires Gmail or HubSpot Single Send. Always logs on HubSpot when configured.
 */
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.HUBSPOT_WRITE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId } = await params;

  let body = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  const capabilities = await getCrmEmailCapabilities(prisma, ctx.tenantId, ctx.user?.id ?? null);
  if (!capabilities.canSend) {
    return NextResponse.json(
      { ok: false, error: "crm_email_not_configured" },
      { status: 412 }
    );
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const messageText = typeof body.body === "string" ? body.body.trim() : "";
  if (!subject || !messageText) {
    return NextResponse.json({ ok: false, error: "subject_and_body_required" }, { status: 400 });
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: ctx.tenantId },
    select: {
      id: true,
      hubspotDealId: true,
      dealContacts: {
        orderBy: { createdAt: "asc" },
        include: {
          contact: {
            select: {
              id: true,
              hubspotContactId: true,
              businessUser: { select: { email: true } },
            },
          },
        },
      },
    },
  });
  if (!deal) {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }
  if (!deal.hubspotDealId) {
    return NextResponse.json({ ok: false, error: "deal_not_in_hubspot" }, { status: 400 });
  }

  const dealContacts = (deal.dealContacts ?? []).map((dc) => dc.contact).filter(Boolean);
  const requestedIds = Array.isArray(body.recipientContactIds)
    ? body.recipientContactIds.filter((x) => typeof x === "string" && x)
    : [];

  let recipients;
  if (requestedIds.length) {
    const wanted = new Set(requestedIds);
    recipients = dealContacts.filter((c) => wanted.has(c.id));
  } else {
    const primary = dealContacts.find((c) => !!c.hubspotContactId);
    recipients = primary ? [primary] : [];
  }

  const syncedRecipients = recipients.filter((c) => !!c.hubspotContactId);
  const recipientContactIds = syncedRecipients.map((c) => c.hubspotContactId);
  const recipientEmails = syncedRecipients.map((c) => c.businessUser?.email).filter(Boolean);

  if (!recipientEmails.length) {
    return NextResponse.json({ ok: false, error: "no_recipients" }, { status: 400 });
  }

  const collateralIds = Array.isArray(body.collateralIds)
    ? body.collateralIds.filter((x) => typeof x === "string" && x)
    : typeof body.collateralId === "string" && body.collateralId
      ? [body.collateralId]
      : [];

  const attachments = [];
  for (const collateralId of collateralIds) {
    try {
      const att = await loadCollateralPdfAttachment(prisma, ctx.tenantId, collateralId);
      if (att) attachments.push(att);
    } catch (err) {
      if (err?.message === "chrome_not_available") {
        return NextResponse.json({ ok: false, error: "pdf_renderer_unavailable" }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: "collateral_pdf_failed" }, { status: 500 });
    }
  }

  let html = plainTextToHtml(messageText);
  const origin = new URL(request.url).origin;
  const willUseSingleSend =
    !capabilities.gmailConnected && capabilities.singleSendConfigured;
  if (willUseSingleSend && attachments.length) {
    html = appendCollateralPdfLinks(html, attachments, origin);
  }

  const gmailAttachments = capabilities.gmailConnected ? attachments : [];

  const result = await deliverNbaEmail(prisma, {
    tenantId: ctx.tenantId,
    userId: ctx.user?.id ?? null,
    hubspotDealId: deal.hubspotDealId,
    subject,
    html,
    recipientEmails,
    recipientContactIds,
    attachments: gmailAttachments,
    collateralTitle: attachments[0]?.filename ?? null,
  });

  if (!result.ok) {
    if (result.reason === "write_scope") {
      return NextResponse.json({ ok: false, reason: "write_scope", delivered: result.delivered ?? false });
    }
    if (result.error === "hubspot_not_configured") {
      return NextResponse.json({ ok: false, error: "hubspot_not_configured" }, { status: 412 });
    }
    return NextResponse.json(
      { ok: false, error: result.error ?? "send_failed", status: result.status },
      { status: 502 }
    );
  }

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: deal.hubspotDealId,
    action: "EMAIL_DRAFTED",
    payload: {
      kind: "crm_email",
      dealId: deal.id,
      subject,
      delivered: result.delivered,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      deliveryChannel: result.deliveryChannel,
      hubspotEmailId: result.hubspotEmailId,
      recipientCount: recipientContactIds.length,
      recipientEmails,
      collateralIds,
      attachmentCount: attachments.length,
    },
  });

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    sent: result.sentCount,
    failed: result.failedCount,
    deliveryChannel: result.deliveryChannel,
    ...(result.deliverReason ? { reason: result.deliverReason } : {}),
    hubspotEmailId: result.hubspotEmailId,
    recipientCount: recipientContactIds.length,
    recipientEmails,
    attachmentCount: attachments.length,
  });
}

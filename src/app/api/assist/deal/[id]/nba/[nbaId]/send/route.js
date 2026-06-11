import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { deliverNbaEmail } from "@/lib/assist/nbaEmailSend";
import { logAssistAction } from "@/lib/assist/logAction";
import {
  loadCollateralEmailAttachment,
  stripCollateralViewerLinks,
} from "@/lib/assist/nbaEmailCollateral";

/**
 * POST — SEND an NBA email.
 *
 * Delivery priority:
 *  1. Connected Gmail (current user's mailbox)
 *  2. HubSpot Single Send (tenant transactional email id)
 *  3. Timeline log only (no real delivery)
 *
 * Always logs the email on the HubSpot deal/contact timeline when HubSpot is configured.
 */
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.HUBSPOT_WRITE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId, nbaId } = await params;

  let body = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  const nba = await prisma.nbaRecommendation.findFirst({
    where: { id: nbaId, dealId, tenantId: ctx.tenantId },
    include: {
      deal: {
        select: {
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
      },
    },
  });
  if (!nba) {
    return NextResponse.json({ error: "nba_not_found" }, { status: 404 });
  }

  const prev = nba.draftPayload && typeof nba.draftPayload === "object" ? nba.draftPayload : {};
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject : prev.subject;
  const rawHtml = typeof body.html === "string" && body.html.trim() ? body.html : prev.emailHtml;
  const html = stripCollateralViewerLinks(rawHtml);
  const documentId =
    (typeof body.documentId === "string" && body.documentId) || prev.documentId || null;
  const collateralTitle = prev.collateralTitle ?? null;

  if (!subject || !html) {
    return NextResponse.json({ ok: false, error: "no_draft" }, { status: 400 });
  }

  const hubspotDealId = nba.deal?.hubspotDealId ?? null;
  if (!hubspotDealId) {
    return NextResponse.json({ ok: false, error: "deal_not_in_hubspot" }, { status: 400 });
  }

  const dealContacts = (nba.deal?.dealContacts ?? []).map((dc) => dc.contact).filter(Boolean);
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

  const collateralAttachment = documentId
    ? await loadCollateralEmailAttachment(prisma, ctx.tenantId, documentId)
    : null;
  const attachments = collateralAttachment ? [collateralAttachment] : [];

  const result = await deliverNbaEmail(prisma, {
    tenantId: ctx.tenantId,
    userId: ctx.user?.id ?? null,
    hubspotDealId,
    subject,
    html,
    recipientEmails,
    recipientContactIds,
    attachments,
    collateralTitle,
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

  const sentAt = new Date().toISOString();
  await prisma.nbaRecommendation.update({
    where: { id: nba.id },
    data: {
      draftPayload: {
        ...prev,
        subject,
        emailHtml: html,
        documentId,
        collateralTitle,
        sentAt,
        hubspotEmailId: result.hubspotEmailId ?? null,
        delivered: result.delivered,
        deliveryChannel: result.deliveryChannel,
      },
    },
  });

  const channelNote =
    result.deliveryChannel === "gmail"
      ? "Delivered via Gmail and logged on HubSpot timeline."
      : result.deliveryChannel === "hubspot_single_send"
        ? "Delivered via HubSpot Single Send and logged on the timeline."
        : "Logged on HubSpot timeline (connect Gmail or Single Send to deliver).";

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: hubspotDealId,
    action: "EMAIL_DRAFTED",
    payload: {
      nbaId: nba.id,
      sent: true,
      delivered: result.delivered,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      deliveryChannel: result.deliveryChannel,
      hubspotEmailId: result.hubspotEmailId,
      recipientCount: recipientContactIds.length,
      recipientEmails,
      note: channelNote,
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
  });
}

import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { logEmailEngagement, associateEmailTo } from "@/lib/assist/hubspotWrite";
import { logAssistAction } from "@/lib/assist/logAction";

/**
 * POST — SEND an NBA email through HubSpot.
 *
 * Body: { subject?, html?, recipientContactIds?: string[] } — subject/html fall
 * back to the NBA's stored draftPayload ({ subject, emailHtml }) when omitted.
 * `recipientContactIds` are Contact (Prisma) ids selected by the AE; they are
 * resolved tenant-scoped and must belong to this deal. When omitted/empty the
 * route falls back to the deal's primary contact (the original behavior).
 *
 * This pushes the email through HubSpot by logging it as an email engagement on
 * the deal/contact timeline (`/crm/v3/objects/emails` + associations). Note:
 * this records the email on the HubSpot timeline — it is NOT an outbound mailbox
 * send. True outbound delivery requires a connected inbox / marketing-send
 * integration, which the MOFU layer does not configure.
 *
 * On a missing HubSpot write scope (403) the route returns a 200-level body
 * `{ ok:false, reason:'write_scope' }` rather than crashing.
 */
export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.HUBSPOT_WRITE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId, nbaId } = await params;

  // Tolerate an empty/absent body.
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
                select: { id: true, hubspotContactId: true, email: true },
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

  const prev = (nba.draftPayload && typeof nba.draftPayload === "object") ? nba.draftPayload : {};
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject : prev.subject;
  const html = typeof body.html === "string" && body.html.trim() ? body.html : prev.emailHtml;

  if (!subject || !html) {
    return NextResponse.json({ ok: false, error: "no_draft" }, { status: 400 });
  }

  const hubspotDealId = nba.deal?.hubspotDealId ?? null;
  if (!hubspotDealId) {
    return NextResponse.json({ ok: false, error: "deal_not_in_hubspot" }, { status: 400 });
  }

  // Deal's contacts (tenant-scoped — the NBA query already filters by tenantId).
  const dealContacts = (nba.deal?.dealContacts ?? [])
    .map((dc) => dc.contact)
    .filter(Boolean);

  // Selected recipients: Contact ids from the body, restricted to this deal's
  // contacts (so an AE can only send to people already on the deal). Falls back
  // to the deal's primary contact (first synced contact) when none are given.
  const requestedIds = Array.isArray(body.recipientContactIds)
    ? body.recipientContactIds.filter((x) => typeof x === "string" && x)
    : [];

  let recipients;
  if (requestedIds.length) {
    const wanted = new Set(requestedIds);
    recipients = dealContacts.filter((c) => wanted.has(c.id));
  } else {
    // Primary contact = first DealContact (by creation order) that is synced to HubSpot.
    const primary = dealContacts.find((c) => !!c.hubspotContactId);
    recipients = primary ? [primary] : [];
  }

  // Only contacts actually synced to HubSpot can be associated to the email.
  const syncedRecipients = recipients.filter((c) => !!c.hubspotContactId);
  const recipientContactIds = syncedRecipients.map((c) => c.hubspotContactId);
  const recipientEmails = syncedRecipients.map((c) => c.email).filter(Boolean);

  const token = await getDecryptedHubspotToken(prisma, ctx.tenantId);
  if (!token) {
    return NextResponse.json({ ok: false, error: "hubspot_not_configured" }, { status: 412 });
  }

  // Log ONE email engagement, associated to the deal. We associate it to every
  // selected contact separately below so each recipient gets it on their timeline.
  const result = await logEmailEngagement(token, {
    dealId: hubspotDealId,
    contactId: null,
    subject,
    html,
  });

  // Missing write scope → degrade gracefully (200-level body, not a crash).
  if (!result.ok) {
    if (result.status === 403) {
      return NextResponse.json({ ok: false, reason: "write_scope" });
    }
    return NextResponse.json(
      { ok: false, error: "hubspot_send_failed", status: result.status },
      { status: 502 }
    );
  }

  // Associate the logged email to EVERY selected (synced) contact's timeline.
  for (const contactId of recipientContactIds) {
    await associateEmailTo(token, result.id, "contacts", contactId);
  }

  const sentAt = new Date().toISOString();
  await prisma.nbaRecommendation.update({
    where: { id: nba.id },
    // Keep status EXECUTED; annotate the draft with send metadata.
    data: { draftPayload: { ...prev, subject, emailHtml: html, sentAt, hubspotEmailId: result.id } },
  });

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: hubspotDealId,
    action: "EMAIL_DRAFTED",
    payload: {
      nbaId: nba.id,
      sent: true,
      hubspotEmailId: result.id,
      recipientCount: recipientContactIds.length,
      recipientEmails,
      note: "Logged on the HubSpot timeline (not an outbound mailbox send).",
    },
  });

  return NextResponse.json({
    ok: true,
    emailId: result.id,
    recipientCount: recipientContactIds.length,
    recipientEmails,
  });
}

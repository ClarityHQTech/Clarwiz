import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { createMeeting, createTask, addNote } from "@/lib/assist/hubspotWrite";
import { logAssistAction } from "@/lib/assist/logAction";

/**
 * POST — SET UP A MEETING for an NBA.
 *
 * Body: { title, startTime, endTime, contactIds?: string[], body? }
 *   - `contactIds` are Contact (Prisma) ids selected by the AE; restricted to
 *     this deal's contacts and resolved to their HubSpot contact ids.
 *
 * Creates a HubSpot meeting engagement, associates it to the deal + selected
 * contacts, then adds a "Meeting scheduled with …" note, marks the NBA EXECUTED
 * and logs MEETING_SCHEDULED.
 *
 * Fallback: when the HubSpot token lacks the meetings write scope (403) we do
 * NOT fail — we create a TASK ("Schedule meeting…") instead and return
 * `{ ok:true, fallbackTask:true, taskId }`.
 *
 * 412 when HubSpot is not configured.
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

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  if (!title) {
    return NextResponse.json({ ok: false, error: "missing_title" }, { status: 400 });
  }
  const startTime = body.startTime ?? null;
  const endTime = body.endTime ?? null;
  const meetingBody = typeof body.body === "string" ? body.body : "";

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
                select: { id: true, hubspotContactId: true, email: true, businessUser: { select: { name: true } } },
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

  const hubspotDealId = nba.deal?.hubspotDealId ?? null;
  if (!hubspotDealId) {
    return NextResponse.json({ ok: false, error: "deal_not_in_hubspot" }, { status: 400 });
  }

  const dealContacts = (nba.deal?.dealContacts ?? []).map((dc) => dc.contact).filter(Boolean);
  const requestedIds = Array.isArray(body.contactIds)
    ? body.contactIds.filter((x) => typeof x === "string" && x)
    : [];
  const wanted = new Set(requestedIds);
  const selected = requestedIds.length
    ? dealContacts.filter((c) => wanted.has(c.id))
    : dealContacts;
  const syncedContactIds = selected.map((c) => c.hubspotContactId).filter(Boolean);
  const attendeeNames = selected
    .map((c) => c.businessUser?.name || c.email)
    .filter(Boolean);

  const token = await getDecryptedHubspotToken(prisma, ctx.tenantId);
  if (!token) {
    return NextResponse.json({ ok: false, error: "hubspot_not_configured" }, { status: 412 });
  }

  const result = await createMeeting(token, {
    dealId: hubspotDealId,
    contactIds: syncedContactIds,
    title,
    body: meetingBody,
    startTime,
    endTime,
  });

  // Missing meetings write scope → fall back to a task instead of failing.
  if (!result.ok && result.reason === "write_scope") {
    const taskRes = await createTask(token, {
      dealId: hubspotDealId,
      subject: `Schedule meeting: ${title}`,
      body:
        `Auto-created because the HubSpot token lacks the meetings write scope.\n` +
        (attendeeNames.length ? `Attendees: ${attendeeNames.join(", ")}\n` : "") +
        (startTime ? `Proposed time: ${startTime}\n` : "") +
        (meetingBody ? `\n${meetingBody}` : ""),
      timestamp: Date.now(),
    });

    await prisma.nbaRecommendation.update({
      where: { id: nba.id },
      data: { status: "EXECUTED", executedAt: new Date() },
    });
    await logAssistAction(prisma, {
      tenantId: ctx.tenantId,
      actorUserId: ctx.user?.id ?? null,
      entityType: "deal",
      hsObjectId: hubspotDealId,
      action: "MEETING_SCHEDULED",
      payload: { nbaId: nba.id, title, fallbackTask: true, taskId: taskRes.id ?? null },
    });

    return NextResponse.json({ ok: true, fallbackTask: true, taskId: taskRes.id ?? null });
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "hubspot_meeting_failed", status: result.status },
      { status: 502 }
    );
  }

  // Note on the deal timeline recording the scheduled meeting.
  const noteBody =
    `Meeting scheduled${attendeeNames.length ? ` with ${attendeeNames.join(", ")}` : ""}: ${title}` +
    (startTime ? ` (at ${startTime})` : "");
  await addNote(token, { dealId: hubspotDealId, body: noteBody });

  await prisma.nbaRecommendation.update({
    where: { id: nba.id },
    data: { status: "EXECUTED", executedAt: new Date() },
  });

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: hubspotDealId,
    action: "MEETING_SCHEDULED",
    payload: { nbaId: nba.id, title, meetingId: result.id, attendees: attendeeNames },
  });

  return NextResponse.json({ ok: true, meetingId: result.id });
}

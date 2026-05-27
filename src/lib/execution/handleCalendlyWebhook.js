import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import {
  findCalendlyIntegrationByOrganizationUri,
  findCalendlyIntegrationByUserUri,
} from "@/lib/calendlyIntegration";
import {
  markProspectQualified,
  QUALIFICATION_REASONS,
} from "@/lib/execution/qualifyProspect";

function extractInviteeEmail(payload) {
  if (!payload || typeof payload !== "object") return null;
  const email =
    payload.email ??
    payload.invitee?.email ??
    payload.scheduled_event?.event_memberships?.[0]?.user_email;
  return email?.trim()?.toLowerCase() ?? null;
}

function extractOrganizationUri(body) {
  return (
    body?.payload?.organization ??
    body?.payload?.scheduled_event?.event_memberships?.[0]?.user ??
    null
  );
}

async function resolveUserIdFromWebhook(body) {
  const orgUri = extractOrganizationUri(body);
  if (orgUri) {
    const byOrg = await findCalendlyIntegrationByOrganizationUri(orgUri);
    if (byOrg) return byOrg.userId;
  }

  const userUri =
    body?.created_by ??
    body?.payload?.scheduled_event?.event_memberships?.[0]?.user;
  if (userUri) {
    const byUser = await findCalendlyIntegrationByUserUri(userUri);
    if (byUser) return byUser.userId;
  }

  const integrations = await prisma.calendlyIntegration.findMany({
    where: { status: "connected" },
    select: { userId: true, organizationUri: true },
  });
  if (integrations.length === 1) return integrations[0].userId;
  return null;
}

async function findProspectsForInvitee(userId, email) {
  if (!email) return [];
  return prisma.prospect.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      campaign: {
        userId,
        status: { in: ["active", "paused", "draft", "completed"] },
      },
    },
    include: { campaign: { select: { id: true, status: true } } },
  });
}

/**
 * Handle Calendly invitee.created / invitee.canceled webhook payloads.
 */
export async function handleCalendlyWebhookEvent(body) {
  const event = body?.event;
  const payload = body?.payload ?? {};
  const userId = await resolveUserIdFromWebhook(body);

  if (!userId) {
    return { ok: false, error: "Could not resolve tenant for webhook" };
  }

  const email = extractInviteeEmail(payload);

  if (event === "invitee.canceled") {
    const rescheduled = payload.rescheduled === true;
    const prospects = await findProspectsForInvitee(userId, email);
    for (const prospect of prospects) {
      await prisma.prospectSignal
        .create({
          data: {
            userId,
            campaignId: prospect.campaignId,
            prospectId: prospect.id,
            type: "calendly_canceled",
            source: "calendly",
            content: JSON.stringify({
              rescheduled,
              canceled: payload.canceled,
              reason: payload.cancellation?.reason ?? null,
            }).slice(0, 2000),
          },
        })
        .catch(() => {});
    }
    return {
      ok: true,
      event,
      logged: prospects.length,
      rescheduled,
    };
  }

  if (event === "invitee.created") {
    if (payload.canceled === true || payload.status === "canceled") {
      return { ok: true, event, skipped: "canceled_invitee" };
    }

    const prospects = await findProspectsForInvitee(userId, email);
    const qualified = [];

    for (const prospect of prospects) {
      const result = await markProspectQualified(prisma, {
        prospectId: prospect.id,
        campaignId: prospect.campaignId,
        reason: QUALIFICATION_REASONS.CALENDLY_BOOKED,
        sourceMeta: {
          email,
          eventUri: payload.uri ?? null,
          scheduledAt:
            payload.scheduled_event?.start_time ??
            payload.event ??
            null,
        },
      });
      if (result.updated) {
        qualified.push(prospect.id);
        await syncCampaignMetrics(prisma, prospect.campaignId);
      }
    }

    return {
      ok: true,
      event,
      email,
      matchedProspects: prospects.length,
      newlyQualified: qualified.length,
    };
  }

  return { ok: true, event, ignored: true };
}

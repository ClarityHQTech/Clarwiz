import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import {
  findCalendlyIntegrationByOrganizationUri,
  findCalendlyIntegrationByUserUri,
} from "@/lib/calendlyIntegration";
import {
  markContactCampaignQualified,
  QUALIFICATION_REASONS,
} from "@/lib/execution/qualifyContact";

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

async function resolveTenantIdFromWebhook(body) {
  const orgUri = extractOrganizationUri(body);
  if (orgUri) {
    const byOrg = await findCalendlyIntegrationByOrganizationUri(orgUri);
    if (byOrg) return byOrg.tenantId;
  }

  const userUri =
    body?.created_by ??
    body?.payload?.scheduled_event?.event_memberships?.[0]?.user;
  if (userUri) {
    const byUser = await findCalendlyIntegrationByUserUri(userUri);
    if (byUser) return byUser.tenantId;
  }

  const integrations = await prisma.calendlyIntegration.findMany({
    where: { status: "connected", connectionMode: "webhooks" },
    select: { tenantId: true, organizationUri: true },
  });
  if (integrations.length === 1) return integrations[0].tenantId;
  return null;
}

async function findContactCampaignsForInvitee(tenantId, email) {
  if (!email) return [];
  return prisma.contactCampaign.findMany({
    where: {
      contact: {
        businessUser: {
          email: { equals: email, mode: "insensitive" },
        },
        tenantId,
      },
      campaign: {
        status: { in: ["active", "paused", "draft", "completed"] },
      },
    },
    include: {
      contact: { select: { businessUserId: true } },
      campaign: { select: { id: true, status: true } },
    },
  });
}

export async function handleCalendlyWebhookEvent(body) {
  const event = body?.event;
  const payload = body?.payload ?? {};
  const tenantId = await resolveTenantIdFromWebhook(body);

  if (!tenantId) {
    return { ok: false, error: "Could not resolve tenant for webhook" };
  }

  const email = extractInviteeEmail(payload);

  if (event === "invitee.canceled") {
    const rescheduled = payload.rescheduled === true;
    const rows = await findContactCampaignsForInvitee(tenantId, email);
    for (const cc of rows) {
      await prisma.businessUserSignal
        .create({
          data: {
            businessUserId: cc.contact.businessUserId,
            tenantId,
            campaignId: cc.campaignId,
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
      logged: rows.length,
      rescheduled,
    };
  }

  if (event === "invitee.created") {
    if (payload.canceled === true || payload.status === "canceled") {
      return { ok: true, event, skipped: "canceled_invitee" };
    }

    const rows = await findContactCampaignsForInvitee(tenantId, email);
    const qualified = [];

    for (const cc of rows) {
      const result = await markContactCampaignQualified(prisma, {
        contactCampaignId: cc.id,
        campaignId: cc.campaignId,
        reason: QUALIFICATION_REASONS.CALENDLY_BOOKED,
        businessUserId: cc.contact.businessUserId,
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
        qualified.push(cc.id);
        await syncCampaignMetrics(prisma, cc.campaignId);
      }
    }

    return {
      ok: true,
      event,
      email,
      matchedProspects: rows.length,
      newlyQualified: qualified.length,
    };
  }

  return { ok: true, event, ignored: true };
}

/**
 * TOFU outreach timeline for the MOFU Lead Workroom (Mode-3 enrichment).
 *
 * A lead's HubSpot identity (Contact → BusinessUser email) is matched against the
 * Clarwiz TOFU outreach graph: CommunicationLog → CampaignContact → Contact →
 * BusinessUser. When the email matches no TOFU rows we simply return [] and the
 * UI shows "No Clarwiz outreach history" — the workroom NEVER depends on TOFU
 * data existing (composability for tenants with zero TOFU activity).
 *
 * Each outbound send is one entry; if a log also carries a response we emit a
 * second inbound entry for the reply. Everything is sorted newest-first.
 */

/**
 * @param {*} prisma  Prisma client (or a fake exposing communicationLog.findMany)
 * @param {string} tenantId
 * @param {string|null|undefined} email  The lead's businessUser email (any case)
 * @returns {Promise<Array<{id,channel,direction,subject,message,cta,status,timestamp}>>}
 */
export async function getTofuTimeline(prisma, tenantId, email) {
  if (!email) return [];
  const normalized = String(email).toLowerCase();

  const logs = await prisma.communicationLog.findMany({
    where: {
      tenantId,
      campaignContact: {
        contact: { businessUser: { email: normalized } },
      },
    },
    orderBy: { sentAt: "desc" },
  });

  const entries = [];
  for (const log of logs) {
    // Outbound: the send itself.
    entries.push({
      id: log.id,
      channel: log.channel ?? null,
      direction: "outbound",
      subject: log.subject ?? null,
      message: log.message ?? null,
      cta: log.ctaType ?? null,
      status: log.status ?? null,
      timestamp: log.sentAt ?? log.createdAt ?? null,
    });

    // Inbound: a reply on the same log, if any.
    if (log.responseType || log.responseAt) {
      entries.push({
        id: log.id,
        channel: log.channel ?? null,
        direction: "inbound",
        subject: log.subject ?? null,
        message: log.responseContent ?? null,
        cta: log.ctaType ?? null,
        status: log.responseType ?? "responded",
        timestamp: log.responseAt ?? log.sentAt ?? null,
      });
    }
  }

  // Newest-first across the (possibly split) entries.
  entries.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));
  return entries;
}

function toMs(ts) {
  if (!ts) return 0;
  const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Pick the stage id for a brand-new deal: the lowest-displayOrder non-closed
 * stage across all deal pipelines. Falls back to the very first stage if every
 * stage is closed, and null when there are no stages at all.
 *
 * @param {{results?: Array<{stages?: Array}>}} pipelinesJson  getDealPipelines() output
 * @returns {string|null}
 */
export function firstOpenStageId(pipelinesJson) {
  const stages = [];
  for (const pipeline of pipelinesJson?.results ?? []) {
    for (const s of pipeline.stages ?? []) stages.push(s);
  }
  if (stages.length === 0) return null;

  const open = stages.filter((s) => s.metadata?.isClosed !== "true");
  const pool = open.length ? open : stages;
  pool.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return pool[0]?.id ?? null;
}

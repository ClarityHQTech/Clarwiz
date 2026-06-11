/**
 * Push a qualified TOFU campaign contact into HubSpot as contact + company + deal.
 *
 * HubSpot is the hand-off point: AE Assist (MOFU) hydrates from HubSpot via
 * sync — we never write directly into MOFU Deal/Account tables from here.
 */
import { getDecryptedHubspotToken, getMofuIntegration } from "@/lib/assist/mofuIntegration";
import { getDealPipelines } from "@/lib/assist/hubspot";
import {
  addNote,
  associate,
  associateContactToCompany,
  createCompany,
  createContact,
  createDeal,
  patchCrmObject,
  searchCompanyByDomain,
  searchContactByEmail,
} from "@/lib/assist/hubspotWrite";
import { firstOpenStageId } from "@/lib/assist/tofuTimeline";
import {
  CLARWIZ_CAMPAIGN_CONTACT_ID_PROP,
  ensureClarwizCampaignContactProperties,
} from "@/lib/crm/campaignContactBridge";

function buildDealName({ contactName, companyName, campaignName }) {
  const who = companyName || contactName || "Qualified lead";
  return `${who} — ${campaignName}`;
}

function buildProvenanceNote({
  campaignName,
  qualifiedReason,
  qualifiedAt,
  score,
  contact,
  company,
  commLogs,
}) {
  const lines = [
    "Qualified in Clarwiz outreach (TOFU) — synced to HubSpot for AE Assist.",
    "",
    `Campaign: ${campaignName}`,
    `Reason: ${qualifiedReason || "qualified"}`,
    qualifiedAt ? `Qualified at: ${new Date(qualifiedAt).toISOString()}` : null,
    score != null ? `Engagement score: ${score}` : null,
    "",
    "Contact:",
    `  Name: ${contact.name || "—"}`,
    `  Email: ${contact.email || "—"}`,
    contact.jobTitle ? `  Title: ${contact.jobTitle}` : null,
    contact.phone ? `  Phone: ${contact.phone}` : null,
    contact.linkedinUrl ? `  LinkedIn: ${contact.linkedinUrl}` : null,
  ].filter(Boolean);

  if (company?.name || company?.domain) {
    lines.push("", "Company:");
    if (company.name) lines.push(`  Name: ${company.name}`);
    if (company.domain) lines.push(`  Domain: ${company.domain}`);
    if (company.industry) lines.push(`  Industry: ${company.industry}`);
  }

  const touches = (commLogs ?? [])
    .filter((l) => l.message?.trim() && l.status !== "skipped")
    .slice(-5);
  if (touches.length) {
    lines.push("", "Recent outreach:");
    for (const log of touches) {
      const when = log.sentAt ? new Date(log.sentAt).toISOString().slice(0, 10) : "—";
      const dir = log.responseContent ? "inbound reply" : "outbound";
      lines.push(`  • [${when}] ${log.channel} ${dir}`);
      if (log.responseContent?.trim()) {
        lines.push(`    Reply: ${log.responseContent.trim().slice(0, 200)}`);
      }
    }
  }

  return lines.join("\n");
}

async function stampCampaignContactId(token, objectType, objectId, campaignContactId, { fetchImpl }) {
  if (!objectId || !campaignContactId) return;
  await patchCrmObject(
    token,
    objectType,
    objectId,
    { [CLARWIZ_CAMPAIGN_CONTACT_ID_PROP]: String(campaignContactId) },
    { fetchImpl }
  ).catch(() => {});
}

async function resolveHubspotContactId(
  token,
  { email, firstName, lastName, jobTitle, phone, companyName, campaignContactId },
  { fetchImpl }
) {
  if (!email) return { id: null, reason: "no_email" };

  let id = await searchContactByEmail(token, email, { fetchImpl });
  if (id) {
    await stampCampaignContactId(token, "contacts", id, campaignContactId, { fetchImpl });
    return { id: String(id), created: false };
  }

  const created = await createContact(
    token,
    { email, firstName, lastName, jobTitle, phone, companyName, campaignContactId },
    { fetchImpl }
  );
  if (!created.ok || !created.id) {
    return { id: null, reason: "contact_create_failed", status: created.status };
  }
  return { id: String(created.id), created: true };
}

async function resolveHubspotCompanyId(token, { name, domain, industry, campaignContactId }, { fetchImpl }) {
  if (!name && !domain) return { id: null };

  if (domain) {
    const existing = await searchCompanyByDomain(token, domain, { fetchImpl });
    if (existing) {
      await stampCampaignContactId(token, "companies", existing, campaignContactId, { fetchImpl });
      return { id: String(existing), created: false };
    }
  }

  const created = await createCompany(token, { name, domain, industry, campaignContactId }, { fetchImpl });
  if (!created.ok || !created.id) {
    return { id: null, reason: "company_create_failed", status: created.status };
  }
  return { id: String(created.id), created: true };
}

/**
 * Push one qualified campaign contact to HubSpot. Idempotent when hubspotDealId
 * is already set. Never throws.
 *
 * @returns {Promise<{ ok:boolean, skipped?:boolean, reason?:string, hubspotDealId?:string, hubspotContactId?:string, hubspotCompanyId?:string }>}
 */
export async function pushQualifiedToHubspot(prisma, campaignContactId, { fetchImpl = fetch } = {}) {
  const cc = await prisma.campaignContact.findUnique({
    where: { id: campaignContactId },
    include: {
      campaign: { select: { id: true, name: true, tenantId: true } },
      contact: {
        include: {
          businessUser: { include: { company: true } },
        },
      },
      commLogs: {
        orderBy: { sentAt: "asc" },
        select: {
          channel: true,
          message: true,
          status: true,
          sentAt: true,
          responseContent: true,
        },
      },
    },
  });

  if (!cc) return { ok: false, reason: "not_found" };
  if (cc.status !== "QUALIFIED") return { ok: false, skipped: true, reason: "not_qualified" };
  if (cc.hubspotDealId) {
    return { ok: true, skipped: true, reason: "already_synced", hubspotDealId: cc.hubspotDealId };
  }

  const tenantId = cc.campaign.tenantId;
  const token = await getDecryptedHubspotToken(prisma, tenantId, { fetchImpl });
  if (!token) return { ok: false, skipped: true, reason: "hubspot_not_configured" };

  await ensureClarwizCampaignContactProperties(token, { fetchImpl });

  const bu = cc.contact.businessUser;
  const company = bu?.company;
  const email = bu?.email ? String(bu.email).trim().toLowerCase() : null;
  const contactName =
    bu?.name ||
    [bu?.firstName, bu?.lastName].filter(Boolean).join(" ").trim() ||
    (email ? email.split("@")[0] : "Contact");

  const contactRes = await resolveHubspotContactId(
    token,
    {
      email,
      firstName: bu?.firstName,
      lastName: bu?.lastName,
      jobTitle: bu?.jobTitle,
      phone: bu?.phone || bu?.whatsapp,
      companyName: company?.name,
      campaignContactId,
    },
    { fetchImpl }
  );
  if (!contactRes.id) {
    return { ok: false, reason: contactRes.reason || "contact_unresolved" };
  }

  let hubspotCompanyId = null;
  if (company?.name || company?.domain) {
    const companyRes = await resolveHubspotCompanyId(
      token,
      {
        name: company.name,
        domain: company.domain,
        industry: company.industry,
        campaignContactId,
      },
      { fetchImpl }
    );
    hubspotCompanyId = companyRes.id;
    if (hubspotCompanyId) {
      await associateContactToCompany(token, contactRes.id, hubspotCompanyId, { fetchImpl }).catch(() => {});
    }
  }

  const integration = await getMofuIntegration(prisma, tenantId);
  const stageId = firstOpenStageId(await getDealPipelines(token, { fetchImpl }));
  const dealName = buildDealName({
    contactName,
    companyName: company?.name,
    campaignName: cc.campaign.name,
  });

  const dealRes = await createDeal(
    token,
    {
      name: dealName,
      stageId,
      ownerId: integration?.defaultOwnerId ?? cc.contact.ownerId ?? null,
      campaignContactId,
    },
    { fetchImpl }
  );
  if (!dealRes.ok || !dealRes.id) {
    return { ok: false, reason: "deal_create_failed", status: dealRes.status };
  }

  const hubspotDealId = String(dealRes.id);
  await associate(token, hubspotDealId, "contacts", contactRes.id, { fetchImpl }).catch(() => {});
  if (hubspotCompanyId) {
    await associate(token, hubspotDealId, "companies", hubspotCompanyId, { fetchImpl }).catch(() => {});
  }

  const noteBody = buildProvenanceNote({
    campaignName: cc.campaign.name,
    qualifiedReason: cc.qualifiedReason,
    qualifiedAt: cc.qualifiedAt,
    score: cc.score,
    contact: {
      name: contactName,
      email,
      jobTitle: bu?.jobTitle,
      phone: bu?.phone || bu?.whatsapp,
      linkedinUrl: bu?.linkedinUrl,
    },
    company: company
      ? { name: company.name, domain: company.domain, industry: company.industry }
      : null,
    commLogs: cc.commLogs,
  });
  await addNote(token, { dealId: hubspotDealId, body: noteBody }, { fetchImpl }).catch(() => {});

  await prisma.$transaction([
    prisma.campaignContact.update({
      where: { id: campaignContactId },
      data: { hubspotDealId, crmSyncedAt: new Date() },
    }),
    ...(cc.contact.hubspotContactId
      ? []
      : [
          prisma.contact.update({
            where: { id: cc.contactId },
            data: { hubspotContactId: contactRes.id },
          }),
        ]),
  ]);

  console.info(
    `[CRM] qualified push ok tenant=${tenantId} cc=${campaignContactId} deal=${hubspotDealId}`
  );

  return {
    ok: true,
    hubspotDealId,
    hubspotContactId: contactRes.id,
    hubspotCompanyId,
  };
}

/** Fire-and-forget CRM push after qualification — never blocks the caller. */
export function enqueueQualifiedCrmPush(prisma, campaignContactId) {
  pushQualifiedToHubspot(prisma, campaignContactId).catch((err) => {
    console.warn(`[CRM] qualified push failed cc=${campaignContactId}: ${err.message}`);
  });
}

/**
 * Push all qualified-but-unsynced contacts for a campaign. Returns per-row results.
 */
export async function syncQualifiedCampaignToCrm(prisma, campaignId, { fetchImpl = fetch } = {}) {
  const rows = await prisma.campaignContact.findMany({
    where: {
      campaignId,
      status: "QUALIFIED",
      hubspotDealId: null,
    },
    select: { id: true },
    orderBy: { qualifiedAt: "asc" },
  });

  const results = [];
  for (const row of rows) {
    const res = await pushQualifiedToHubspot(prisma, row.id, { fetchImpl });
    results.push({ campaignContactId: row.id, ...res });
  }

  const synced = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok && !r.skipped).length;

  return { ok: failed === 0, total: rows.length, synced, skipped, failed, results };
}

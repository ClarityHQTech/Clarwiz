import {
  getHubSpotIntegration,
  isHubSpotConnected,
  decryptHubSpotToken,
} from "@/lib/hubspot/hubspotIntegration";
import { hubspotFetch } from "@/lib/hubspot/hubspotClient";
import { mapHubSpotDeal, DEAL_PROPERTIES } from "@/lib/hubspot/hubspotMappers";

/**
 * The single SOR implementation (HubSpot). Every method follows the not-connected
 * convention: missing/invalid integration -> {ok:false, reason:"sor_not_connected"},
 * never a throw (mirrors src/lib/push buildSkippedPush).
 */

async function resolveToken(tenantId, deps) {
  const integ = await getHubSpotIntegration(tenantId, deps);
  if (!isHubSpotConnected(integ)) return { ok: false, reason: "sor_not_connected" };
  return { ok: true, accessToken: decryptHubSpotToken(integ.encryptedAccessToken) };
}

/** Create a CRM object and associate it to the deal (v4 default association). */
async function createAndAssociate({ accessToken, objectType, properties, dealId, fetchImpl }) {
  const created = await hubspotFetch(`/crm/v3/objects/${objectType}`, {
    accessToken,
    method: "POST",
    body: { properties },
    fetchImpl,
  });
  if (dealId) {
    await hubspotFetch(
      `/crm/v4/objects/${objectType}/${created.id}/associations/default/deals/${dealId}`,
      { accessToken, method: "PUT", fetchImpl }
    );
  }
  return created;
}

export const hubspotAdapter = {
  // ---- reads ----
  async getDeal(tenantId, hubspotDealId, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      const json = await hubspotFetch(
        `/crm/v3/objects/deals/${hubspotDealId}?properties=${DEAL_PROPERTIES.join(",")}`,
        { accessToken: t.accessToken, fetchImpl: deps.fetchImpl }
      );
      return { ok: true, deal: mapHubSpotDeal(json) };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async getDealEngagements(tenantId, hubspotDealId, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    return { ok: true, items: [] }; // expanded with engagement search in Phase D
  },

  // Associated company + contacts for a deal (for company/contact-level intelligence).
  async getDealAssociations(tenantId, hubspotDealId, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    const fetchImpl = deps.fetchImpl;
    try {
      const [compAssoc, contAssoc] = await Promise.all([
        hubspotFetch(`/crm/v4/objects/deals/${hubspotDealId}/associations/companies`, { accessToken: t.accessToken, fetchImpl }).catch(() => ({ results: [] })),
        hubspotFetch(`/crm/v4/objects/deals/${hubspotDealId}/associations/contacts`, { accessToken: t.accessToken, fetchImpl }).catch(() => ({ results: [] })),
      ]);
      const companyIds = (compAssoc.results || []).map((r) => r.toObjectId).filter(Boolean);
      const contactIds = (contAssoc.results || []).map((r) => r.toObjectId).filter(Boolean);

      let company = null;
      if (companyIds.length) {
        const cj = await hubspotFetch(`/crm/v3/objects/companies/batch/read`, {
          accessToken: t.accessToken,
          method: "POST",
          body: { properties: ["name", "domain", "industry"], inputs: companyIds.slice(0, 1).map((id) => ({ id })) },
          fetchImpl,
        });
        const c = cj.results?.[0];
        if (c) company = { id: c.id, name: c.properties.name ?? null, domain: c.properties.domain ?? null, industry: c.properties.industry ?? null };
      }

      let contacts = [];
      if (contactIds.length) {
        const xj = await hubspotFetch(`/crm/v3/objects/contacts/batch/read`, {
          accessToken: t.accessToken,
          method: "POST",
          body: { properties: ["firstname", "lastname", "email", "jobtitle"], inputs: contactIds.slice(0, 25).map((id) => ({ id })) },
          fetchImpl,
        });
        contacts = (xj.results || []).map((c) => ({
          id: c.id,
          name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ") || c.properties.email || "Contact",
          email: c.properties.email ?? null,
          title: c.properties.jobtitle ?? null,
        }));
      }
      return { ok: true, company, contacts };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async listDeals(tenantId, { limit = 100 } = {}, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      const json = await hubspotFetch(
        `/crm/v3/objects/deals?limit=${limit}&properties=${DEAL_PROPERTIES.join(",")}`,
        { accessToken: t.accessToken, fetchImpl: deps.fetchImpl }
      );
      return { ok: true, deals: (json.results || []).map(mapHubSpotDeal) };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  // ---- writes (executors) ----
  async logEmail(tenantId, { dealId, subject, body }, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      const created = await createAndAssociate({
        accessToken: t.accessToken,
        objectType: "emails",
        properties: {
          hs_email_subject: subject,
          hs_email_text: body,
          hs_email_direction: "EMAIL",
          hs_timestamp: Date.now(),
        },
        dealId,
        fetchImpl: deps.fetchImpl,
      });
      return { ok: true, engagementId: created.id };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async createTask(tenantId, { dealId, title, body, dueAt }, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      const created = await createAndAssociate({
        accessToken: t.accessToken,
        objectType: "tasks",
        properties: {
          hs_task_subject: title,
          hs_task_body: body ?? "",
          hs_task_status: "NOT_STARTED",
          hs_timestamp: dueAt ? new Date(dueAt).getTime() : Date.now(),
        },
        dealId,
        fetchImpl: deps.fetchImpl,
      });
      return { ok: true, engagementId: created.id };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async createNote(tenantId, { dealId, body }, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      const created = await createAndAssociate({
        accessToken: t.accessToken,
        objectType: "notes",
        properties: { hs_note_body: body, hs_timestamp: Date.now() },
        dealId,
        fetchImpl: deps.fetchImpl,
      });
      return { ok: true, engagementId: created.id };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async createMeeting(tenantId, { dealId, title, body, startAt, endAt }, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      const created = await createAndAssociate({
        accessToken: t.accessToken,
        objectType: "meetings",
        properties: {
          hs_meeting_title: title,
          hs_meeting_body: body ?? "",
          hs_timestamp: startAt ? new Date(startAt).getTime() : Date.now(),
          hs_meeting_start_time: startAt ? new Date(startAt).getTime() : Date.now(),
          hs_meeting_end_time: endAt ? new Date(endAt).getTime() : Date.now(),
        },
        dealId,
        fetchImpl: deps.fetchImpl,
      });
      return { ok: true, engagementId: created.id };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  // ---- transition writes (Epic 12) ----
  async upsertCompany(tenantId, { name, domain }, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      if (domain) {
        const found = await hubspotFetch(`/crm/v3/objects/companies/search`, {
          accessToken: t.accessToken,
          method: "POST",
          body: { filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }], limit: 1 },
          fetchImpl: deps.fetchImpl,
        });
        if (found.results?.length) return { ok: true, id: found.results[0].id, deduped: true };
      }
      const created = await hubspotFetch(`/crm/v3/objects/companies`, {
        accessToken: t.accessToken,
        method: "POST",
        body: { properties: { name, domain: domain ?? undefined } },
        fetchImpl: deps.fetchImpl,
      });
      return { ok: true, id: created.id, deduped: false };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async upsertContact(tenantId, { email, firstName, lastName, companyId }, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      if (email) {
        const found = await hubspotFetch(`/crm/v3/objects/contacts/search`, {
          accessToken: t.accessToken,
          method: "POST",
          body: { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], limit: 1 },
          fetchImpl: deps.fetchImpl,
        });
        if (found.results?.length) return { ok: true, id: found.results[0].id, deduped: true };
      }
      const created = await hubspotFetch(`/crm/v3/objects/contacts`, {
        accessToken: t.accessToken,
        method: "POST",
        body: { properties: { email, firstname: firstName ?? undefined, lastname: lastName ?? undefined } },
        fetchImpl: deps.fetchImpl,
      });
      if (companyId) {
        await hubspotFetch(
          `/crm/v4/objects/contacts/${created.id}/associations/default/companies/${companyId}`,
          { accessToken: t.accessToken, method: "PUT", fetchImpl: deps.fetchImpl }
        ).catch(() => {});
      }
      return { ok: true, id: created.id, deduped: false };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },

  async createDeal(tenantId, { name, companyId, contactId, stage, amount }, deps = {}) {
    const t = await resolveToken(tenantId, deps);
    if (!t.ok) return t;
    try {
      const created = await hubspotFetch(`/crm/v3/objects/deals`, {
        accessToken: t.accessToken,
        method: "POST",
        body: { properties: { dealname: name, dealstage: stage ?? undefined, amount: amount != null ? String(amount) : undefined } },
        fetchImpl: deps.fetchImpl,
      });
      for (const [type, id] of [["companies", companyId], ["contacts", contactId]]) {
        if (id) {
          await hubspotFetch(
            `/crm/v4/objects/deals/${created.id}/associations/default/${type}/${id}`,
            { accessToken: t.accessToken, method: "PUT", fetchImpl: deps.fetchImpl }
          ).catch(() => {});
        }
      }
      return { ok: true, id: created.id };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },
};

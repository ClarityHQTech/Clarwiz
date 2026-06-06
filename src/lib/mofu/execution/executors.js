import { getSorAdapter } from "@/lib/sor/SorAdapter";
import { notifyTeam } from "@/lib/mofu/notify";
import { generateCollateral } from "@/lib/mofu/collateral/engine";
import { loadDealOntology } from "@/lib/mofu/templates";
import { getAppBaseUrl } from "@/lib/cronAuth";

// Each closed action type maps to exactly one executor. Outbound sends go through
// HubSpot; PREP_MEETING is an internal brief; CALL_WITH_SCRIPT is script-only (D5).
export async function runExecutor({ actionType, tenantId, deal, draft = {} }, deps = {}) {
  const adapter = deps.adapter ?? getSorAdapter();
  const dealId = deal?.hubspotDealId;

  switch (actionType) {
    case "SEND_EMAIL": {
      const r = await adapter.logEmail(
        tenantId,
        { dealId, subject: draft.subject ?? deal?.name ?? "Follow up", body: draft.body ?? "", contactId: draft.recipient?.id, toEmail: draft.recipient?.email },
        deps.adapterDeps
      );
      return r.ok ? { ok: true, engagementId: r.engagementId, recipient: draft.recipient ?? null } : { ok: false, reason: r.reason };
    }
    case "SEND_MARKETING_COLLATERAL":
    case "SEND_SALES_COLLATERAL": {
      // Ensure a collateral document exists, then attach a link in the email to the recipient.
      const category = actionType === "SEND_SALES_COLLATERAL" ? "sales" : "marketing";
      let docLink = null;
      try {
        const context = await (deps.loadDealOntology ?? loadDealOntology)({ tenantId, dealId: deal.id });
        const g = await (deps.generateCollateral ?? generateCollateral)({
          tenantId, dealId: deal.id, templateId: draft.templateId ?? "builtin:one_pager", category, context,
        });
        if (g.ok) docLink = `${getAppBaseUrl()}/api/mofu/documents/${g.documentId}/html`;
      } catch {
        /* attachment is best-effort */
      }
      const body = (draft.body ?? "") + (docLink ? `\n\nCollateral: ${docLink}` : "");
      const r = await adapter.logEmail(
        tenantId,
        { dealId, subject: draft.subject ?? deal?.name ?? "Resource for you", body, contactId: draft.recipient?.id, toEmail: draft.recipient?.email },
        deps.adapterDeps
      );
      return r.ok ? { ok: true, engagementId: r.engagementId, recipient: draft.recipient ?? null, document: docLink } : { ok: false, reason: r.reason };
    }
    case "SCHEDULE_MEETING": {
      const r = await adapter.createMeeting(
        tenantId,
        { dealId, title: draft.title ?? draft.subject ?? "Meeting", body: draft.body, startAt: draft.startAt, endAt: draft.endAt },
        deps.adapterDeps
      );
      return r.ok ? { ok: true, engagementId: r.engagementId } : { ok: false, reason: r.reason };
    }
    case "UPDATE_CRM_CREATE_TASK": {
      const r = await adapter.createTask(
        tenantId,
        { dealId, title: draft.title ?? draft.subject ?? "Follow up task", body: draft.body, dueAt: draft.dueAt },
        deps.adapterDeps
      );
      return r.ok ? { ok: true, engagementId: r.engagementId } : { ok: false, reason: r.reason };
    }
    case "NOTIFY_TEAM": {
      const r = await (deps.notifyTeam ?? notifyTeam)(
        { message: draft.body ?? draft.message ?? "Deal update", deepLink: draft.deepLink },
        deps.notifyDeps
      );
      return r.ok ? { ok: true, engagementId: r.id ?? null, skipped: r.skipped } : { ok: false, reason: r.reason };
    }
    case "PREP_MEETING": {
      return { ok: true, internal: true, brief: draft.body ?? draft.brief ?? "" };
    }
    case "CALL_WITH_SCRIPT": {
      // D5: generate + log a script only (no dialer). Stored as a note for the rep.
      const r = await adapter.createNote(
        tenantId,
        { dealId, body: `Call script:\n${draft.body ?? draft.script ?? ""}` },
        deps.adapterDeps
      );
      return r.ok ? { ok: true, engagementId: r.engagementId, internal: true } : { ok: false, reason: r.reason };
    }
    default:
      return { ok: false, reason: "unknown_action_type" };
  }
}

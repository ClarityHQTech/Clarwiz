import {
  draftRecommendation as defaultDraft,
  approveRecommendation as defaultApprove,
  executeRecommendation as defaultExecute,
} from "@/lib/mofu/execution/rails";
import { OUTBOUND_ACTIONS } from "@/lib/mofu/nbaActions";

// US-13.1 / D7 — Autopilot auto-executes only low-risk internal actions. Customer-
// facing outbound (SEND_*, SCHEDULE_MEETING) always holds for AE approval.
export const AUTOPILOT_ALLOWLIST = new Set(["PREP_MEETING", "UPDATE_CRM_CREATE_TASK", "NOTIFY_TEAM"]);

export async function runAutopilot({ tenantId, recommendations = [] }, deps = {}) {
  const draft = deps.draftRecommendation ?? defaultDraft;
  const approve = deps.approveRecommendation ?? defaultApprove;
  const execute = deps.executeRecommendation ?? defaultExecute;

  const results = [];
  for (const rec of recommendations) {
    if (!AUTOPILOT_ALLOWLIST.has(rec.actionType)) {
      results.push({ recId: rec.id, skipped: true, reason: "not_allowlisted" });
      continue;
    }
    await draft({ tenantId, recId: rec.id });
    if (OUTBOUND_ACTIONS.has(rec.actionType)) {
      await approve({ tenantId, recId: rec.id, actor: "autopilot" });
    }
    const r = await execute({ tenantId, recId: rec.id, actor: "autopilot", surface: "autopilot" });
    results.push({ recId: rec.id, ok: r.ok, reason: r.reason });
  }
  return { executed: results.filter((r) => r.ok).length, results };
}

"use client";

import { CkCard } from "../cockpit/primitives";
import { fmtStaleness } from "../cockpit/format";

const ACTION_LABEL = {
  INSIGHT_COMPUTED: "Insight computed",
  NBA_DRAFTED: "Next-best-action drafted",
  NBA_EXECUTED: "Action executed",
  EMAIL_DRAFTED: "Email drafted",
  COLLATERAL_SENT: "Collateral sent",
  TASK_CREATED: "Task created",
  NOTE_ADDED: "Note added",
  DEAL_CREATED: "Deal created",
  MEETING_SCHEDULED: "Meeting scheduled",
  CHAT_QUERY: "Chat query",
};

export function actionLabel(a) {
  return ACTION_LABEL[a] || a;
}

export function actionDot(action) {
  switch (action) {
    case "NBA_EXECUTED":
    case "DEAL_CREATED":
    case "NOTE_ADDED":
    case "TASK_CREATED":
      return "ok";
    case "INSIGHT_COMPUTED":
    case "CHAT_QUERY":
    case "COLLATERAL_SENT":
      return "info";
    case "NBA_DRAFTED":
    case "EMAIL_DRAFTED":
      return "accent";
    default:
      return "";
  }
}

/**
 * Right-rail activity feed (cockpit) from recentAssistActions().
 * actions = AssistActionLog[] { action, entityType, hsObjectId, createdAt }
 */
export default function ActivityFeed({ actions = [] }) {
  return (
    <CkCard title="Recent activity" count={actions.length || undefined}>
      {actions.length === 0 ? (
        <div className="ck-empty">No activity yet.</div>
      ) : (
        <div>
          {actions.map((a) => (
            <div className="ck-log-row" key={a.id}>
              <div className="ck-log-time">{fmtStaleness(a.createdAt)}</div>
              <div className={`ck-log-dot ${actionDot(a.action)}`} />
              <div className="ck-log-text">
                <strong>{actionLabel(a.action)}</strong>
                {a.entityType ? ` · ${a.entityType}` : ""}
                {a.hsObjectId ? ` · ${a.hsObjectId}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </CkCard>
  );
}

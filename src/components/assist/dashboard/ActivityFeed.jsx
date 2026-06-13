"use client";

import { fmtStaleness } from "../format";
import { ui } from "@/lib/brandUi";

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

const DOT_STYLES = {
  ok: "bg-brand-sage",
  info: "bg-brand-terracotta/70",
  accent: "bg-brand-gold",
  "": "bg-brand-steel",
};

export default function ActivityFeed({ actions = [] }) {
  return (
    <div className={ui.cardSurface}>
      <div className={`px-4 py-3 ${ui.tableToolbar}`}>
        <h2 className={`${ui.titleSm} text-base`}>
          Recent activity
          {actions.length > 0 ? (
            <span className="ml-2 text-sm font-sans font-normal text-brand-stone">({actions.length})</span>
          ) : null}
        </h2>
      </div>
      {actions.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-brand-stone">No activity yet.</p>
      ) : (
        <ul className={ui.divider}>
          {actions.map((a) => (
            <li key={a.id} className="flex gap-3 px-4 py-2.5">
              <span className="text-xs text-brand-steel tabular-nums w-14 shrink-0 pt-0.5">
                {fmtStaleness(a.createdAt)}
              </span>
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_STYLES[actionDot(a.action)] ?? DOT_STYLES[""]}`}
              />
              <p className="text-sm text-brand-ink min-w-0">
                <span className="font-medium">{actionLabel(a.action)}</span>
                {a.entityType ? <span className="text-brand-stone"> · {a.entityType}</span> : null}
                {a.hsObjectId ? <span className="text-brand-stone"> · {a.hsObjectId}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import { actionLabel, actionDot } from "@/components/assist/dashboard/ActivityFeed";

function dayKey(d) {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function timeOf(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function isToday(d) {
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

/** Group actions into ordered day buckets (newest first). */
function groupByDay(actions) {
  const groups = [];
  const index = new Map();
  for (const a of actions) {
    const key = dayKey(a.createdAt);
    if (!index.has(key)) {
      const g = { key, label: (isToday(a.createdAt) ? "Today · " : "") + key, rows: [] };
      index.set(key, g);
      groups.push(g);
    }
    index.get(key).rows.push(a);
  }
  return groups;
}

/**
 * Activity Log (cockpit). Append-only audit feed grouped by day, each row with a
 * time, colored dot, and action text. Ids only — never PII or message bodies.
 */
function ActivityLogClient({ actions = [] }) {
  const groups = groupByDay(actions);

  return (
    <AssistShell active="log" crumbs={["All activity"]}>
      <div className="ck-page-header">
        <div className="ck-page-title-block">
          <div className="ck-eyebrow">Append-only audit feed</div>
          <h1 className="ck-page-title">
            Activity <em>Log</em>
          </h1>
          <p className="ck-page-subtitle">
            Every NBA executed, task created, note added, insight computed. Ids only — never PII or
            message bodies.
          </p>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="ck-card">
          <div className="ck-empty">No activity yet. Actions you take across the assist layer show up here.</div>
        </div>
      ) : (
        <div className="ck-card">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="ck-log-day">{g.label}</div>
              {g.rows.map((a) => (
                <div className="ck-log-row" key={a.id}>
                  <div className="ck-log-time">{timeOf(a.createdAt)}</div>
                  <div className={`ck-log-dot ${actionDot(a.action)}`} />
                  <div className="ck-log-text">
                    <strong>{actionLabel(a.action)}</strong>
                    {a.entityType ? (
                      <>
                        {" on "}
                        <em>
                          {a.entityType}
                          {a.hsObjectId ? ` · ${a.hsObjectId}` : ""}
                        </em>
                      </>
                    ) : a.hsObjectId ? (
                      <em> · {a.hsObjectId}</em>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </AssistShell>
  );
}

export default DashboardLayout()(ActivityLogClient);

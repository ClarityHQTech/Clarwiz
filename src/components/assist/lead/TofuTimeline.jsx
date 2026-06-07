"use client";

import { CkCard, CkBadge } from "../cockpit/primitives";

function formatTs(ts) {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * TOFU outreach timeline (cockpit, Mode-3 enrichment). Newest-first from
 * getTofuTimeline. Empty → "No Clarwiz outreach history" (not an error).
 */
export default function TofuTimeline({ entries = [] }) {
  return (
    <CkCard title="Engagement Timeline · TOFU + Web" count={entries.length || undefined}>
      {entries.length === 0 ? (
        <div className="ck-empty">No Clarwiz outreach history.</div>
      ) : (
        entries.map((e, i) => {
          const inbound = e.direction === "inbound";
          return (
            <div className="ck-log-row" key={`${e.id}-${e.direction}-${i}`}>
              <div className="ck-log-time">{formatTs(e.timestamp)}</div>
              <div className={`ck-log-dot ${inbound ? "ok" : "accent"}`} />
              <div className="ck-log-text">
                <strong style={{ textTransform: "capitalize" }}>{e.channel || "activity"}</strong>{" "}
                <CkBadge variant={inbound ? "ok" : "ghost"}>{inbound ? "Reply" : "Sent"}</CkBadge>
                {e.subject ? ` — ${e.subject}` : ""}
                {e.cta ? ` · CTA: ${e.cta}` : ""}
              </div>
            </div>
          );
        })
      )}
    </CkCard>
  );
}

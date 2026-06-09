"use client";

import AssistBadge from "../ui/AssistBadge";
import { AssistPanel, AssistEmpty } from "../ui/AssistPanel";

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

export default function TofuTimeline({ entries = [] }) {
  return (
    <AssistPanel title="Engagement timeline" count={entries.length || undefined}>
      {entries.length === 0 ? (
        <AssistEmpty>No Clarwiz outreach history.</AssistEmpty>
      ) : (
        <ul className="divide-y divide-brand-secondary/15">
          {entries.map((e, i) => {
            const inbound = e.direction === "inbound";
            return (
              <li key={`${e.id}-${e.direction}-${i}`} className="flex gap-3 px-4 py-3">
                <time className="text-xs text-brand-steel tabular-nums w-24 shrink-0 pt-0.5">
                  {formatTs(e.timestamp)}
                </time>
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    inbound ? "bg-brand-sage" : "bg-brand-terracotta/70"
                  }`}
                />
                <p className="text-sm text-brand-ink min-w-0">
                  <span className="font-medium capitalize">{e.channel || "activity"}</span>{" "}
                  <AssistBadge variant={inbound ? "ok" : "ghost"}>{inbound ? "Reply" : "Sent"}</AssistBadge>
                  {e.subject ? ` — ${e.subject}` : ""}
                  {e.cta ? ` · CTA: ${e.cta}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </AssistPanel>
  );
}

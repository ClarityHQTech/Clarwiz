"use client";

import { AssistPanel } from "../ui/AssistPanel";

export function tierDot(s) {
  const tier = String(s.tier || "").toLowerCase();
  if (tier === "hot" || tier === "t1" || tier === "high") return "t1";
  if (tier === "warm" || tier === "t2" || tier === "medium") return "t2";
  if (tier === "t3" || tier === "low" || tier === "cold") return "t3";
  const score = typeof s.score === "number" ? s.score : null;
  if (score != null) {
    if (score >= 70) return "t1";
    if (score >= 40) return "t2";
  }
  return "t3";
}

export function signalLabel(s) {
  return s.headline || s.category || s.type || "Signal";
}

const DOT_CLASS = {
  t1: "bg-red-500",
  t2: "bg-brand-gold",
  t3: "bg-brand-terracotta/70",
};

export default function SignalsStrip({ signals }) {
  if (!signals?.length) return null;

  return (
    <AssistPanel title="Active signals" count={signals.length}>
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {signals.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-bg border border-brand-secondary/25 px-3 py-1 text-xs font-medium text-brand-ink"
            title={s.evidence || s.suggestedAngle || ""}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${DOT_CLASS[tierDot(s)]}`} />
            {signalLabel(s)}
          </span>
        ))}
      </div>
    </AssistPanel>
  );
}

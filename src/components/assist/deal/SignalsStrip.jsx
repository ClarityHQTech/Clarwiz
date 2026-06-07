"use client";

import { CkCard } from "../cockpit/primitives";

/** Map a signal to a tier dot class (t1 danger / t2 warn / t3 info). */
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

/** Horizontal strip of deal-level signals (cockpit chips with tier dots). */
export default function SignalsStrip({ signals }) {
  if (!signals?.length) return null;

  return (
    <CkCard title="Active Signals" count={signals.length}>
      <div className="ck-signals-strip">
        {signals.map((s) => (
          <span
            className="ck-signal-chip"
            key={s.id}
            title={s.evidence || s.suggestedAngle || ""}
          >
            <span className={`dot ${tierDot(s)}`} />
            {signalLabel(s)}
          </span>
        ))}
      </div>
    </CkCard>
  );
}

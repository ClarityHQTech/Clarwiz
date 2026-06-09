"use client";

import RecomputeButton from "./RecomputeButton";

/** Shown when a deal has no DealInsight yet — invites the AE to analyze it (cockpit). */
export default function EmptyInsight({ dealId }) {
  return (
    <div className="ck-card" style={{ padding: 40, textAlign: "center" }}>
      <div className="ck-page-title" style={{ fontSize: 26, marginBottom: 12 }}>
        No analysis <em>yet</em>
      </div>
      <p className="ck-page-subtitle" style={{ margin: "0 auto 20px" }}>
        This deal hasn&apos;t been analyzed. Run the intelligence engine to generate a briefing,
        GTM paths, signals, and next best actions.
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <RecomputeButton dealId={dealId} label="Analyze this deal" variant="primary" />
      </div>
    </div>
  );
}

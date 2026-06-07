"use client";

import { CkCard, CkBadge } from "../cockpit/primitives";

/** Risks (early warnings), wins (positive outcomes), and coaching tip (cockpit). */
export default function RisksCard({ earlyWarnings, positiveOutcomes, coachingTip }) {
  const hasAny = earlyWarnings.length || positiveOutcomes.length || coachingTip;
  if (!hasAny) return null;

  return (
    <div className="ck-stack">
      {positiveOutcomes.length > 0 && (
        <CkCard title="What's going well" count={positiveOutcomes.length}>
          {positiveOutcomes.map((o, i) => (
            <div className="ck-risk-card" key={i}>
              <div className="ck-risk-card-header">
                <div className="ck-risk-name">{o}</div>
                <CkBadge variant="ok">Win</CkBadge>
              </div>
            </div>
          ))}
        </CkCard>
      )}

      {earlyWarnings.length > 0 && (
        <CkCard title="Risks & Early Warnings" count={earlyWarnings.length}>
          {earlyWarnings.map((w, i) => (
            <div className="ck-risk-card" key={i}>
              <div className="ck-risk-card-header">
                <div className="ck-risk-name">{w}</div>
                <CkBadge variant="danger">Risk</CkBadge>
              </div>
            </div>
          ))}
        </CkCard>
      )}

      {coachingTip && (
        <div className="ck-coaching">
          <div className="ck-coaching-quote">&ldquo;</div>
          <div className="ck-coaching-label">Coaching</div>
          <div className="ck-coaching-text">{coachingTip}</div>
        </div>
      )}
    </div>
  );
}

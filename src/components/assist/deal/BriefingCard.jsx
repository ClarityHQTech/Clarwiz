"use client";

import { fmtStaleness } from "../cockpit/format";

/**
 * Deal briefing (cockpit, W1): serif briefing text (summary + account briefing),
 * an AURA insight callout, the italic-serif "your coach speaks" block, and the
 * likelihood / follow-up meters. Renders from toDealViewModel output.
 */
export default function BriefingCard({ vm }) {
  const { briefing, insightDetected, likelihoodToProgress, followUpEffort, insightComputedAt } = vm;

  const hasAny =
    briefing.briefSummary ||
    briefing.accountLevelBriefing ||
    briefing.coachSpeaks ||
    insightDetected.label ||
    likelihoodToProgress ||
    followUpEffort;

  if (!hasAny) {
    return (
      <div className="ck-briefing">
        <div className="ck-briefing-label">Account Briefing</div>
        <div className="ck-risk-desc">No briefing has been generated for this deal yet.</div>
      </div>
    );
  }

  const lead = briefing.briefSummary || briefing.accountLevelBriefing;
  const secondary =
    briefing.briefSummary && briefing.accountLevelBriefing ? briefing.accountLevelBriefing : null;

  return (
    <div className="ck-briefing">
      <div className="ck-briefing-label">
        Account Briefing{insightComputedAt ? ` · Computed ${fmtStaleness(insightComputedAt)}` : ""}
      </div>

      {lead && <div className="ck-briefing-text">{lead}</div>}
      {secondary && (
        <div className="ck-briefing-text" style={{ fontSize: 15, marginTop: 14, color: "var(--text-2)" }}>
          {secondary}
        </div>
      )}

      {(insightDetected.label || insightDetected.explanation) && (
        <div className="ck-insight-callout">
          <div className="lbl">AURA insight detected</div>
          {insightDetected.label && <div className="title">{insightDetected.label}</div>}
          {insightDetected.explanation && <div className="body">{insightDetected.explanation}</div>}
        </div>
      )}

      {briefing.coachSpeaks && (
        <div className="ck-coach">
          <div className="lbl">Your coach speaks</div>
          <div className="body">{briefing.coachSpeaks}</div>
        </div>
      )}

      {(likelihoodToProgress || followUpEffort) && (
        <div className="ck-meter-row">
          {likelihoodToProgress && (
            <div className="ck-meter">
              <div className="lbl">Likelihood to progress</div>
              <div className="val">{likelihoodToProgress}</div>
            </div>
          )}
          {followUpEffort && (
            <div className="ck-meter">
              <div className="lbl">Follow-up effort</div>
              <div className="val">{followUpEffort}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

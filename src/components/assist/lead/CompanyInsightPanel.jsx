"use client";

import { CkCard, CkBadge } from "../cockpit/primitives";
import { asScore } from "../cockpit/format";

function asString(v) {
  return typeof v === "string" && v.trim() ? v : null;
}
function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function pluck(rows, key) {
  return asArray(rows)
    .map((r) => (r && typeof r === "object" ? asString(r[key]) : asString(r)))
    .filter(Boolean);
}

/**
 * Company-level AURA insight panel (cockpit). Reads CompanyInsight.payload
 * defensively — every field is optional and the panel degrades to a compute
 * notice when no insight has been stored yet.
 */
export default function CompanyInsightPanel({ insight, company, account }) {
  const payload = insight?.payload && typeof insight.payload === "object" ? insight.payload : null;
  const companyName = company?.name || account?.payload?.name || "Company";

  if (!payload) {
    return (
      <CkCard title={`Account · ${companyName}`}>
        <div className="ck-empty">No company insight computed yet.</div>
      </CkCard>
    );
  }

  const summary =
    asString(payload.account_level_briefing) ||
    asString(payload.brief_summary) ||
    asString(payload.summary);
  const detected =
    payload.aura_insight_detected && typeof payload.aura_insight_detected === "object"
      ? payload.aura_insight_detected
      : {};
  const insightLabel = asString(detected.insight_label);
  const insightExplanation = asString(detected.insight_explanation);
  const score = asScore(payload.account_score);
  const positives = pluck(payload.positive_outcomes_observed, "outcome");
  const warnings = pluck(payload.early_warning_signal, "warning_signal");

  const action = score != null ? <CkBadge variant="accent">Score {score}</CkBadge> : null;

  return (
    <CkCard title={`Account · ${companyName}`} action={action}>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {summary && <div className="ck-risk-desc" style={{ fontSize: 13 }}>{summary}</div>}

        {(insightLabel || insightExplanation) && (
          <div className="ck-insight-callout" style={{ marginTop: 0 }}>
            {insightLabel && <div className="title">{insightLabel}</div>}
            {insightExplanation && <div className="body">{insightExplanation}</div>}
          </div>
        )}

        {positives.length > 0 && (
          <div>
            <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Positive signals</div>
            {positives.map((p, i) => (
              <div className="ck-risk-desc" key={i} style={{ marginBottom: 4 }}>
                <span style={{ color: "var(--ok)" }}>✓ </span>
                {p}
              </div>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Watch-outs</div>
            {warnings.map((w, i) => (
              <div className="ck-risk-desc" key={i} style={{ marginBottom: 4 }}>
                <span style={{ color: "var(--danger)" }}>⚠ </span>
                {w}
              </div>
            ))}
          </div>
        )}
      </div>
    </CkCard>
  );
}

"use client";

import AssistBadge from "../ui/AssistBadge";
import { AssistPanel, AssistEmpty } from "../ui/AssistPanel";
import { BriefingBlock } from "../ui/AssistPrimitives";
import { asScore } from "../format";
import { ui } from "@/lib/brandUi";

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

export default function CompanyInsightPanel({ insight, company, account }) {
  const payload = insight?.payload && typeof insight.payload === "object" ? insight.payload : null;
  const companyName = company?.name || account?.payload?.name || "Company";

  if (!payload) {
    return (
      <AssistPanel title={`Account · ${companyName}`}>
        <AssistEmpty>No company insight computed yet.</AssistEmpty>
      </AssistPanel>
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

  return (
    <AssistPanel
      title={`Account · ${companyName}`}
      action={score != null ? <AssistBadge variant="accent">Score {score}</AssistBadge> : null}
      bodyClassName="px-4 pb-4 space-y-4"
    >
      {summary ? <p className="text-sm text-brand-ink leading-relaxed">{summary}</p> : null}

      {(insightLabel || insightExplanation) && (
        <BriefingBlock label="AURA insight">
          {insightLabel ? <p className="font-medium mb-1">{insightLabel}</p> : null}
          {insightExplanation}
        </BriefingBlock>
      )}

      {positives.length > 0 ? (
        <div>
          <p className={`${ui.label} mb-2 normal-case tracking-wide`}>Positive signals</p>
          <ul className="space-y-1">
            {positives.map((p, i) => (
              <li key={i} className="text-sm text-brand-ink">
                <span className="text-brand-sage">✓ </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div>
          <p className={`${ui.label} mb-2 normal-case tracking-wide`}>Watch-outs</p>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-brand-ink">
                <span className="text-red-600">⚠ </span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AssistPanel>
  );
}

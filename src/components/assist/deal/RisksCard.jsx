"use client";

import AssistBadge from "../ui/AssistBadge";
import { AssistPanel } from "../ui/AssistPanel";
import { BriefingBlock } from "../ui/AssistPrimitives";

function RiskList({ title, items, variant, label }) {
  if (!items.length) return null;
  return (
    <AssistPanel title={title} count={items.length}>
      <ul className="divide-y divide-brand-secondary/15">
        {items.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
            <p className="text-sm text-brand-ink">{item}</p>
            <AssistBadge variant={variant}>{label}</AssistBadge>
          </li>
        ))}
      </ul>
    </AssistPanel>
  );
}

export default function RisksCard({ earlyWarnings, positiveOutcomes, coachingTip }) {
  const hasAny = earlyWarnings.length || positiveOutcomes.length || coachingTip;
  if (!hasAny) return null;

  return (
    <div className="space-y-4">
      <RiskList title="What's going well" items={positiveOutcomes} variant="ok" label="Win" />
      <RiskList title="Risks & early warnings" items={earlyWarnings} variant="danger" label="Risk" />
      {coachingTip ? (
        <BriefingBlock label="Coaching">
          <span className="text-brand-stone italic">&ldquo;{coachingTip}&rdquo;</span>
        </BriefingBlock>
      ) : null}
    </div>
  );
}

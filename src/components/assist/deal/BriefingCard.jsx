"use client";

import { fmtStaleness } from "../format";
import { AssistPanel } from "../ui/AssistPanel";
import { AssistEmpty } from "../ui/AssistPanel";
import { BriefingBlock } from "../ui/AssistPrimitives";
import { ui } from "@/lib/brandUi";

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
      <AssistPanel title="Account briefing">
        <AssistEmpty>No briefing has been generated for this deal yet.</AssistEmpty>
      </AssistPanel>
    );
  }

  const lead = briefing.briefSummary || briefing.accountLevelBriefing;
  const secondary =
    briefing.briefSummary && briefing.accountLevelBriefing ? briefing.accountLevelBriefing : null;

  return (
    <AssistPanel
      title="Account briefing"
      action={
        insightComputedAt ? (
          <span className="text-xs text-brand-stone">Computed {fmtStaleness(insightComputedAt)}</span>
        ) : null
      }
    >
      <div className="px-4 pb-4 space-y-4">
        {lead ? <p className="text-sm text-brand-ink leading-relaxed">{lead}</p> : null}
        {secondary ? <p className="text-sm text-brand-stone leading-relaxed">{secondary}</p> : null}

        {(insightDetected.label || insightDetected.explanation) && (
          <BriefingBlock label="AURA insight detected">
            {insightDetected.label ? <p className="font-medium mb-1">{insightDetected.label}</p> : null}
            {insightDetected.explanation}
          </BriefingBlock>
        )}

        {briefing.coachSpeaks ? (
          <BriefingBlock label="Your coach speaks">
            <em>{briefing.coachSpeaks}</em>
          </BriefingBlock>
        ) : null}

        {(likelihoodToProgress || followUpEffort) && (
          <div className="grid sm:grid-cols-2 gap-3">
            {likelihoodToProgress ? (
              <div className={ui.miniStat}>
                <p className="text-xs text-brand-stone">Likelihood to progress</p>
                <p className="text-sm font-semibold text-brand-ink mt-0.5">{likelihoodToProgress}</p>
              </div>
            ) : null}
            {followUpEffort ? (
              <div className={ui.miniStat}>
                <p className="text-xs text-brand-stone">Follow-up effort</p>
                <p className="text-sm font-semibold text-brand-ink mt-0.5">{followUpEffort}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AssistPanel>
  );
}

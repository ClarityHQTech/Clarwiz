"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AssistBadge from "../ui/AssistBadge";
import { AssistPanel, AssistEmpty } from "../ui/AssistPanel";
import EmailModal from "./EmailModal";
import MeetingModal from "./MeetingModal";
import BriefModal from "./BriefModal";
import { classifyNbaAction } from "@/lib/assist/nbaActions";
import { ui } from "@/lib/brandUi";

function primaryLabel(kind, status) {
  if (status === "EXECUTED") {
    return kind === "meeting" ? "View meeting" : "View draft";
  }
  switch (kind) {
    case "meeting":
      return "Schedule meeting";
    case "task":
      return "Add task";
    case "collateral":
      return "Draft email";
    default:
      return "Execute";
  }
}

function statusBadge(status) {
  switch (status) {
    case "EXECUTED":
      return <AssistBadge variant="ok">Executed</AssistBadge>;
    case "DRAFTED":
    case "APPROVED":
      return <AssistBadge variant="info">Drafted</AssistBadge>;
    case "DISMISSED":
      return <AssistBadge variant="ghost">Dismissed</AssistBadge>;
    default:
      return <AssistBadge variant="accent">Suggested</AssistBadge>;
  }
}

export default function NbaRail({ dealId, nbas, contacts = [] }) {
  const router = useRouter();
  const [emailNba, setEmailNba] = useState(null);
  const [meetingNba, setMeetingNba] = useState(null);
  const [briefNba, setBriefNba] = useState(null);

  const openPrimary = (nba) => {
    const { kind } = classifyNbaAction(nba);
    if (kind === "meeting") setMeetingNba(nba);
    else setEmailNba(nba);
  };

  return (
    <>
      <AssistPanel title="Next best actions" count={nbas?.length || undefined}>
        {!nbas?.length ? (
          <AssistEmpty>No recommendations yet.</AssistEmpty>
        ) : (
          <ul className="divide-y divide-brand-secondary/15">
            {nbas.map((nba) => {
              const { kind } = classifyNbaAction(nba);
              return (
                <li key={nba.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-ink">
                        {nba.title || nba.actionType || "Recommended action"}
                      </p>
                      {nba.rationale ? (
                        <p className="text-xs text-brand-stone mt-1">{nba.rationale}</p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {typeof nba.score === "number" ? (
                        <p className="text-sm font-semibold text-brand-terracotta tabular-nums">+{nba.score}</p>
                      ) : null}
                      {statusBadge(nba.status)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={ui.btnPrimary} onClick={() => openPrimary(nba)}>
                      {primaryLabel(kind, nba.status)}
                    </button>
                    {kind === "meeting" ? (
                      <button type="button" className={ui.btnSecondarySurface} onClick={() => setBriefNba(nba)}>
                        Pre-meeting brief
                      </button>
                    ) : null}
                    {nba.actionType ? (
                      <span className="text-xs text-brand-stone self-center">{nba.actionType}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AssistPanel>

      {emailNba ? (
        <EmailModal
          dealId={dealId}
          nba={emailNba}
          contacts={contacts}
          isOpen={!!emailNba}
          onClose={() => setEmailNba(null)}
          onExecuted={() => router.refresh()}
        />
      ) : null}

      {meetingNba ? (
        <MeetingModal
          dealId={dealId}
          nba={meetingNba}
          contacts={contacts}
          isOpen={!!meetingNba}
          onClose={() => setMeetingNba(null)}
          onScheduled={() => router.refresh()}
        />
      ) : null}

      {briefNba ? (
        <BriefModal
          dealId={dealId}
          nba={briefNba}
          isOpen={!!briefNba}
          onClose={() => setBriefNba(null)}
          onDraftFollowup={() => {
            const nba = briefNba;
            setBriefNba(null);
            setEmailNba(nba);
          }}
        />
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CkCard, CkBadge } from "../cockpit/primitives";
import EmailModal from "./EmailModal";
import MeetingModal from "./MeetingModal";
import BriefModal from "./BriefModal";
import CollateralEditorModal from "@/components/assist/collateral/CollateralEditorModal";
import { classifyNbaAction } from "@/lib/assist/nbaActions";

/** Primary-button label for a classified NBA. */
function primaryLabel(kind, status) {
  if (status === "EXECUTED") {
    return kind === "meeting" ? "View meeting →" : "View draft →";
  }
  switch (kind) {
    case "meeting":
      return "Schedule meeting →";
    case "task":
      return "Add task →";
    case "collateral":
      return "Draft email →";
    default:
      return "Execute →";
  }
}

function statusBadge(status) {
  switch (status) {
    case "EXECUTED":
      return <CkBadge variant="ok">Executed</CkBadge>;
    case "DRAFTED":
    case "APPROVED":
      return <CkBadge variant="info">Drafted</CkBadge>;
    case "DISMISSED":
      return <CkBadge variant="ghost">Dismissed</CkBadge>;
    default:
      return <CkBadge variant="accent">Suggested</CkBadge>;
  }
}

/**
 * Right-rail of NBA recommendations (cockpit). Each card shows a SUGGESTED badge,
 * score, rationale and an Execute action that opens the cockpit EmailModal
 * (draft → edit → Send via HubSpot).
 *
 * nba = NbaRecommendation { id, title, actionType, rationale, score, status, draftPayload? }
 */
export default function NbaRail({ dealId, nbas, contacts = [] }) {
  const router = useRouter();
  const [emailNba, setEmailNba] = useState(null);
  const [meetingNba, setMeetingNba] = useState(null);
  const [briefNba, setBriefNba] = useState(null);
  const [genDocId, setGenDocId] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Primary action for an NBA card: open the modal that fits its classified kind.
  const openPrimary = (nba) => {
    const { kind } = classifyNbaAction(nba);
    if (kind === "meeting") setMeetingNba(nba);
    else setEmailNba(nba); // email | collateral | task all draft an email here
  };

  const generateCollateral = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/assist/collateral/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot + Anthropic to generate collateral.");
        return;
      }
      if (!res.ok || !data.documentId) {
        toast.error(data.error || "Collateral generation failed");
        return;
      }
      toast.success(data.reused ? "Opened existing collateral" : "Collateral generated");
      setGenDocId(data.documentId);
    } catch {
      toast.error("Collateral generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const headerAction = (
    <button
      type="button"
      className="ck-btn ck-btn-ghost"
      style={{ fontSize: 11, padding: "5px 10px" }}
      onClick={generateCollateral}
      disabled={generating}
    >
      {generating ? "Generating…" : "⚡ Generate collateral"}
    </button>
  );

  return (
    <CkCard title="Next Best Actions" count={nbas?.length || undefined} action={headerAction}>
      {!nbas?.length ? (
        <div className="ck-empty">No recommendations yet.</div>
      ) : (
        nbas.map((nba) => {
          const { kind } = classifyNbaAction(nba);
          return (
          <div className="ck-nba-item" key={nba.id}>
            <div className="ck-nba-row">
              <div style={{ minWidth: 0 }}>
                <div className="ck-nba-title">{nba.title || nba.actionType || "Recommended action"}</div>
                {nba.rationale && <div className="ck-nba-rationale">{nba.rationale}</div>}
                <div className="ck-nba-actions">
                  <button type="button" className="ck-nba-action primary" onClick={() => openPrimary(nba)}>
                    {primaryLabel(kind, nba.status)}
                  </button>
                  {kind === "meeting" && (
                    <button type="button" className="ck-nba-action" onClick={() => setBriefNba(nba)}>
                      Pre-meeting brief
                    </button>
                  )}
                  {nba.actionType && (
                    <span className="ck-nba-action" style={{ cursor: "default" }}>
                      {nba.actionType}
                    </span>
                  )}
                </div>
              </div>
              <div className="ck-nba-side">
                {typeof nba.score === "number" && <div className="ck-nba-score">+{nba.score}</div>}
                {statusBadge(nba.status)}
              </div>
            </div>
          </div>
          );
        })
      )}

      {emailNba && (
        <EmailModal
          dealId={dealId}
          nba={emailNba}
          contacts={contacts}
          isOpen={!!emailNba}
          onClose={() => setEmailNba(null)}
          onExecuted={() => router.refresh()}
        />
      )}

      {meetingNba && (
        <MeetingModal
          dealId={dealId}
          nba={meetingNba}
          contacts={contacts}
          isOpen={!!meetingNba}
          onClose={() => setMeetingNba(null)}
          onScheduled={() => router.refresh()}
        />
      )}

      {briefNba && (
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
      )}

      {genDocId && (
        <CollateralEditorModal documentId={genDocId} onClose={() => setGenDocId(null)} />
      )}
    </CkCard>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CkCard, CkBadge } from "../cockpit/primitives";
import EmailModal from "./EmailModal";

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
export default function NbaRail({ dealId, nbas }) {
  const router = useRouter();
  const [activeNba, setActiveNba] = useState(null);

  return (
    <CkCard title="Next Best Actions" count={nbas?.length || undefined}>
      {!nbas?.length ? (
        <div className="ck-empty">No recommendations yet.</div>
      ) : (
        nbas.map((nba) => (
          <div className="ck-nba-item" key={nba.id}>
            <div className="ck-nba-row">
              <div style={{ minWidth: 0 }}>
                <div className="ck-nba-title">{nba.title || nba.actionType || "Recommended action"}</div>
                {nba.rationale && <div className="ck-nba-rationale">{nba.rationale}</div>}
                <div className="ck-nba-actions">
                  <button type="button" className="ck-nba-action primary" onClick={() => setActiveNba(nba)}>
                    {nba.status === "EXECUTED" ? "View draft →" : "Execute →"}
                  </button>
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
        ))
      )}

      {activeNba && (
        <EmailModal
          dealId={dealId}
          nba={activeNba}
          isOpen={!!activeNba}
          onClose={() => setActiveNba(null)}
          onExecuted={() => router.refresh()}
        />
      )}
    </CkCard>
  );
}

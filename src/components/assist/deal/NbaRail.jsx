"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CkCard, CkBadge } from "../cockpit/primitives";
import EmailModal from "./EmailModal";
import CollateralEditorModal from "@/components/assist/collateral/CollateralEditorModal";

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
  const [activeNba, setActiveNba] = useState(null);
  const [genDocId, setGenDocId] = useState(null);
  const [generating, setGenerating] = useState(false);

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
          contacts={contacts}
          isOpen={!!activeNba}
          onClose={() => setActiveNba(null)}
          onExecuted={() => router.refresh()}
        />
      )}

      {genDocId && (
        <CollateralEditorModal documentId={genDocId} onClose={() => setGenDocId(null)} />
      )}
    </CkCard>
  );
}

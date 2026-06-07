"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Cockpit modal showing a generated PRE-MEETING BRIEF for a meeting NBA.
 *
 * On open it POSTs /api/assist/deal/[dealId]/nba/[nbaId]/brief (or shows an
 * already-stored brief from nba.draftPayload.brief). The brief is markdown,
 * rendered as preformatted text. Actions:
 *   - "Add as note" → POSTs /api/assist/deal/[dealId]/note (HubSpot timeline)
 *   - "Draft follow-up email" → hands off to the email flow (onDraftFollowup)
 *
 * Props: { dealId, nba, isOpen, onClose, onDraftFollowup }
 */
export default function BriefModal({ dealId, nba, isOpen, onClose, onDraftFollowup }) {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/nba/${nba.id}/brief`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast.error(data.reason || data.error || "Brief generation failed");
        return;
      }
      setBrief(data.brief || "");
    } catch {
      toast.error("Brief generation failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const existing = nba?.draftPayload?.brief;
    if (existing) {
      setBrief(existing);
    } else {
      setBrief("");
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nba?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const addAsNote = async () => {
    if (!brief.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: `Pre-meeting brief:\n\n${brief}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Settings to add notes.");
        return;
      }
      if (!res.ok || data.ok === false) {
        if (data.reason === "write_scope") toast.warning("Your HubSpot token lacks note write scope.");
        else toast.error(data.error || "Failed to add note");
        return;
      }
      toast.success("Brief added as a note");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="ck-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="ck-email-frame" role="dialog" aria-label="Pre-meeting brief">
        <div className="ck-email-header">
          <div>
            <div className="ck-email-eyebrow">NBA · Pre-meeting brief</div>
            <div className="ck-email-title">{nba?.title || "Pre-meeting brief"}</div>
          </div>
          <button
            type="button"
            className="ck-drawer-close"
            style={{ position: "relative", top: 0, right: 0 }}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="ck-email-body">
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p className="ck-risk-desc">Preparing your brief…</p>
            </div>
          ) : brief ? (
            <div
              className="ck-email-preview"
              style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55 }}
            >
              {brief}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p className="ck-risk-desc" style={{ marginBottom: 16 }}>No brief yet.</p>
              <button type="button" className="ck-btn ck-btn-primary" onClick={generate}>
                Generate brief →
              </button>
            </div>
          )}
        </div>

        <div className="ck-email-footer">
          <div className="ck-email-footer-meta">{brief ? "Generated · grounded in deal context" : ""}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {brief && (
              <button type="button" className="ck-btn ck-btn-ghost" onClick={generate} disabled={loading}>
                Re-generate
              </button>
            )}
            <button type="button" className="ck-btn" onClick={addAsNote} disabled={!brief || savingNote}>
              {savingNote ? "Saving…" : "Add as note"}
            </button>
            <button
              type="button"
              className="ck-btn ck-btn-primary"
              onClick={() => onDraftFollowup?.()}
              disabled={!brief}
            >
              Draft follow-up email →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CkCard } from "../cockpit/primitives";

/**
 * POST-MEETING NOTES capture (cockpit).
 *
 * The AE pastes notes/transcript from a call or meeting; on save they are
 * written to the deal's HubSpot timeline AND fed into signal extraction
 * (recomputeSignals) so they produce new Signals. This is the primary way an AE
 * populates signals on a deal that has no call transcripts yet.
 *
 * POSTs /api/assist/deal/[dealId]/nba/post-meeting/post-meeting — nbaId is part
 * of the route path but unused for this deal-level capture, so we pass a literal.
 *
 * Props: { dealId }
 */
export default function PostMeetingCard({ dealId }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const autoFetched = useRef(false);

  /**
   * Pull the deal's meeting bodies + notes from HubSpot and pre-fill the
   * textarea. If the textarea already has content we append below a divider
   * rather than clobbering unsaved edits. `silent` suppresses the
   * "nothing-to-fetch" toasts (used by the non-blocking auto-fetch on mount).
   *
   * NOTE: only meeting bodies + notes are fetched today; call transcripts can be
   * added later once the crm.extensions_calling_transcripts scope is granted.
   */
  const fetchFromHubspot = async (silent = false) => {
    setFetching(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/meeting-notes`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        if (!silent) toast.error("Connect HubSpot in Settings to fetch meeting notes.");
        return;
      }
      if (!res.ok || data.ok === false || !data.text) {
        if (!silent) {
          toast.message(
            "No meeting notes in HubSpot yet — connect the appointments scope if you expected some."
          );
        }
        return;
      }
      const incoming = data.text.trim();
      setNotes((prev) => {
        const existing = prev.trim();
        if (!existing) return incoming;
        if (existing.includes(incoming)) return prev;
        return `${existing}\n\n---\n${incoming}`;
      });
      const n = data.count ?? 0;
      toast.success(`Pulled ${n} meeting/note${n === 1 ? "" : "s"} from HubSpot`);
    } catch {
      if (!silent) toast.error("Failed to fetch meeting notes");
    } finally {
      setFetching(false);
    }
  };

  // Non-blocking auto-fetch once on mount when the textarea is empty.
  useEffect(() => {
    if (autoFetched.current) return;
    autoFetched.current = true;
    if (!notes.trim()) fetchFromHubspot(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const save = async () => {
    const text = notes.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/nba/post-meeting/post-meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Settings to save meeting notes.");
        return;
      }
      if (!res.ok || data.ok === false) {
        if (data.reason === "write_scope") toast.warning("Your HubSpot token lacks note write scope.");
        else toast.error(data.error || "Failed to save notes");
        return;
      }
      const n = data.signalCount ?? 0;
      toast.success(
        n > 0
          ? `Notes saved · ${n} new signal${n === 1 ? "" : "s"} extracted`
          : "Notes saved to HubSpot"
      );
      setNotes("");
      router.refresh();
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CkCard title="Post-meeting notes">
      <div style={{ padding: 18 }}>
        <div className="ck-risk-desc" style={{ marginBottom: 10, fontSize: 12 }}>
          Paste call or meeting notes. They are saved to HubSpot and used to extract fresh signals.
        </div>
        <textarea
          className="ck-textarea"
          style={{ minHeight: 120 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was discussed, who said what, objections, next steps…"
          rows={5}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <button
            type="button"
            className="ck-btn"
            onClick={() => fetchFromHubspot(false)}
            disabled={fetching}
            title="Pull this deal's meeting bodies + notes from HubSpot"
          >
            {fetching ? "Fetching…" : "⟳ Fetch from HubSpot"}
          </button>
          <button
            type="button"
            className="ck-btn ck-btn-primary"
            onClick={save}
            disabled={saving || !notes.trim()}
          >
            {saving ? "Saving…" : "Save & extract signals"}
          </button>
        </div>
      </div>
    </CkCard>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CkCard } from "../cockpit/primitives";

/** Free-text note → written back to the deal in HubSpot (cockpit). */
export default function NoteBox({ dealId }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Settings to add notes.");
        return;
      }
      if (!res.ok || data.ok === false) {
        if (data.reason === "write_scope") {
          toast.warning("Your HubSpot token lacks note write scope.");
        } else {
          toast.error(data.error || "Failed to add note");
        }
        return;
      }
      toast.success("Note added to HubSpot");
      setBody("");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CkCard title="Add a note">
      <div style={{ padding: 18 }}>
        <textarea
          className="ck-textarea"
          style={{ minHeight: 96 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Log a quick update on this deal…"
          rows={4}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            type="button"
            className="ck-btn ck-btn-primary"
            onClick={onSave}
            disabled={saving || !body.trim()}
          >
            {saving ? "Saving…" : "Save to HubSpot"}
          </button>
        </div>
      </div>
    </CkCard>
  );
}

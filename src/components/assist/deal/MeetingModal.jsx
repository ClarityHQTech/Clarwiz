"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Cockpit modal to SET UP A MEETING for a meeting-type NBA.
 *
 * Fields: title (prefilled from the NBA), datetime-local start (defaults to
 * +2 days at 10:00), duration (minutes), the deal's contacts as a multi-select
 * (reusing EmailModal's pill pattern), and an optional agenda/notes body.
 *
 * POSTs to /api/assist/deal/[dealId]/nba/[nbaId]/meeting. On a missing meetings
 * write scope the route falls back to a TASK — we surface that as a notice.
 *
 * Props: { dealId, nba, contacts, isOpen, onClose, onScheduled }
 */
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(10, 0, 0, 0);
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MeetingModal({ dealId, nba, contacts = [], isOpen, onClose, onScheduled }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStart());
  const [duration, setDuration] = useState(30);
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(nba?.title || "Meeting");
    setStart(defaultStart());
    setDuration(30);
    setBody("");
    setSelectedIds((contacts || []).map((c) => c.id).filter(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nba?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const endTimeIso = useMemo(() => {
    if (!start) return null;
    const startMs = new Date(start).getTime();
    if (Number.isNaN(startMs)) return null;
    return new Date(startMs + duration * 60000).toISOString();
  }, [start, duration]);

  const startIso = useMemo(() => {
    if (!start) return null;
    const ms = new Date(start).getTime();
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }, [start]);

  if (!isOpen) return null;

  const toggle = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const schedule = async () => {
    if (!title.trim()) {
      toast.error("Meeting title is required");
      return;
    }
    if (!startIso) {
      toast.error("Pick a valid start time");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/nba/${nba.id}/meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          startTime: startIso,
          endTime: endTimeIso,
          contactIds: selectedIds,
          body: body.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Settings to schedule meetings.");
        return;
      }
      if (!res.ok || data.ok === false) {
        toast.error(data.error || "Failed to schedule meeting");
        return;
      }
      if (data.fallbackTask) {
        toast.warning("HubSpot token lacks meeting scope — created a task to schedule it instead.");
      } else {
        toast.success("Meeting scheduled in HubSpot");
      }
      onScheduled?.();
      onClose?.();
    } catch {
      toast.error("Failed to schedule meeting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ck-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="ck-email-frame" role="dialog" aria-label="Schedule meeting">
        <div className="ck-email-header">
          <div>
            <div className="ck-email-eyebrow">NBA · Schedule meeting</div>
            <div className="ck-email-title">{nba?.title || "Set up a meeting"}</div>
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
          {nba?.rationale && (
            <div className="ck-risk-desc" style={{ marginBottom: 16 }}>{nba.rationale}</div>
          )}

          <div className="ck-email-field">
            <div className="lbl">Title</div>
            <input
              className="ck-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title"
            />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <div className="ck-email-field" style={{ flex: 1 }}>
              <div className="lbl">Start</div>
              <input
                type="datetime-local"
                className="ck-input"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="ck-email-field" style={{ width: 140 }}>
              <div className="lbl">Duration</div>
              <select
                className="ck-input"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          <div className="ck-email-field" style={{ marginTop: 16 }}>
            <div className="lbl" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Attendees</span>
              <span className="ck-email-eyebrow" style={{ textTransform: "none" }}>
                {selectedIds.length} selected
              </span>
            </div>
            {!(contacts || []).length ? (
              <div className="ck-risk-desc" style={{ fontSize: 12 }}>No people on this deal.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {(contacts || []).map((c) => {
                  const selected = selectedIds.includes(c.id);
                  return (
                    <button
                      key={c.id || c.email}
                      type="button"
                      onClick={() => c.id && toggle(c.id)}
                      aria-pressed={selected}
                      style={{
                        cursor: "pointer",
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 2,
                        textAlign: "left",
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: selected ? "var(--accent-soft)" : "var(--elevated)",
                        border: `1px solid ${selected ? "var(--accent-line)" : "var(--line)"}`,
                        color: "var(--text)",
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--accent)" : "var(--text)" }}>
                        {selected ? "✓ " : ""}
                        {c.name || c.email || "Contact"}
                        {c.title ? ` · ${c.title}` : ""}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{c.email || "no email"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="ck-email-eyebrow" style={{ marginBottom: 6 }}>Agenda / notes</div>
            <textarea
              className="ck-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="What's this meeting about?"
            />
          </div>
        </div>

        <div className="ck-email-footer">
          <div className="ck-email-footer-meta">Creates a HubSpot meeting on the deal timeline</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ck-btn ck-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="ck-btn ck-btn-primary" onClick={schedule} disabled={saving}>
              {saving ? "Scheduling…" : "Schedule meeting →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

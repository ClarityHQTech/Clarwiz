"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { toast } from "sonner";
import { modalShell, modalUi, ui } from "@/lib/brandUi";

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(10, 0, 0, 0);
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
        toast.error("Connect HubSpot in Integrations to schedule meetings.");
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
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl" scrollBehavior="inside" closeOnOverlayClick={!saving}>
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent {...modalShell.content} {...modalShell.contentCentered} maxW="2xl" className={modalUi.contentClass}>
        <ModalHeader {...modalShell.header} className={`${modalUi.headerClass} !border-b`}>
          <p className={`${ui.label} mb-1 normal-case tracking-wide font-sans`}>NBA · Schedule meeting</p>
          <span className="font-serif text-lg">{nba?.title || "Set up a meeting"}</span>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} isDisabled={saving} />

        <ModalBody {...modalShell.body} {...modalShell.bodyPadded} className={`${modalUi.bodyClass} space-y-4`}>
          {nba?.rationale ? <p className={ui.body}>{nba.rationale}</p> : null}

          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Title</label>
            <input className={ui.inputSurface} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" />
          </div>

          <div className="grid sm:grid-cols-[1fr_140px] gap-3">
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Start</label>
              <input
                type="datetime-local"
                className={ui.inputSurface}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Duration</label>
              <select className={ui.inputSurface} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`${ui.label} normal-case tracking-normal`}>Attendees</label>
              <span className="text-xs text-brand-stone">{selectedIds.length} selected</span>
            </div>
            {!(contacts || []).length ? (
              <p className={ui.body}>No people on this deal.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(contacts || []).map((c) => {
                  const selected = selectedIds.includes(c.id);
                  const email = c?.email || c?.businessUser?.email || null;
                  const name = c?.name || c?.businessUser?.name || null;
                  const jobTitle = c?.title || c?.businessUser?.jobTitle || null;
                  return (
                    <button
                      key={c.id || email}
                      type="button"
                      onClick={() => c.id && toggle(c.id)}
                      aria-pressed={selected}
                      className={`inline-flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-brand-terracotta/50 bg-brand-terracotta/10 text-brand-ink"
                          : "border-brand-secondary/30 bg-brand-surface text-brand-ink hover:bg-brand-bg"
                      }`}
                    >
                      <span className={`text-xs font-semibold ${selected ? "text-brand-terracotta" : ""}`}>
                        {selected ? "✓ " : ""}
                        {name || email || "Contact"}
                        {jobTitle ? ` · ${jobTitle}` : ""}
                      </span>
                      <span className="text-[11px] text-brand-stone">{email || "no email"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Agenda / notes</label>
            <textarea
              className={`${ui.inputSurface} resize-y min-h-[96px]`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="What's this meeting about?"
            />
          </div>
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={`${modalUi.footerClass} !border-t flex-wrap gap-2`}>
          <p className={`${ui.label} normal-case tracking-normal mr-auto`}>Creates a HubSpot meeting on the deal timeline</p>
          <button type="button" className={ui.btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={ui.btnPrimary} onClick={schedule} disabled={saving}>
            {saving ? "Scheduling…" : "Schedule meeting"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

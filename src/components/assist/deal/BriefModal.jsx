"use client";

import { useEffect, useState } from "react";
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
        toast.error("Connect HubSpot in Integrations to add notes.");
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
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent {...modalShell.content} {...modalShell.contentCentered} maxW="2xl" className={modalUi.contentClass}>
        <ModalHeader {...modalShell.header} className={`${modalUi.headerClass} !border-b`}>
          <p className={`${ui.label} mb-1 normal-case tracking-wide font-sans`}>NBA · Pre-meeting brief</p>
          <span className="font-serif text-lg">{nba?.title || "Pre-meeting brief"}</span>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} />

        <ModalBody {...modalShell.body} {...modalShell.bodyPadded} className={modalUi.bodyClass}>
          {loading ? (
            <p className={`${ui.body} py-12 text-center`}>Preparing your brief…</p>
          ) : brief ? (
            <div className={`${ui.cardMuted} p-4 text-sm text-brand-ink leading-relaxed whitespace-pre-wrap max-h-[50vh] overflow-y-auto`}>
              {brief}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className={`${ui.body} mb-4`}>No brief yet.</p>
              <button type="button" className={ui.btnPrimary} onClick={generate}>
                Generate brief
              </button>
            </div>
          )}
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={`${modalUi.footerClass} !border-t flex-wrap gap-2`}>
          <p className={`${ui.label} normal-case tracking-normal mr-auto`}>
            {brief ? "Generated · grounded in deal context" : ""}
          </p>
          {brief ? (
            <button type="button" className={ui.btnGhost} onClick={generate} disabled={loading}>
              Re-generate
            </button>
          ) : null}
          <button type="button" className={ui.btnSecondary} onClick={addAsNote} disabled={!brief || savingNote}>
            {savingNote ? "Saving…" : "Add as note"}
          </button>
          <button type="button" className={ui.btnPrimary} onClick={() => onDraftFollowup?.()} disabled={!brief}>
            Draft follow-up email
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

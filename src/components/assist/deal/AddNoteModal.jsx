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

export default function AddNoteModal({ dealId, isOpen, onClose }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) setBody("");
  }, [isOpen]);

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
        toast.error("Connect HubSpot in Integrations to add notes.");
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
      onClose?.();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="lg"
      scrollBehavior="inside"
      closeOnOverlayClick={!saving}
    >
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent
        {...modalShell.content}
        {...modalShell.contentCentered}
        className={`${modalUi.contentClass} !flex !flex-col`}
      >
        <ModalHeader {...modalShell.header} className={`${modalUi.headerClass} !border-b`}>
          <p className={`${ui.label} mb-1 normal-case tracking-wide font-sans`}>CRM note</p>
          <span className="font-serif text-lg">Add a note in HubSpot</span>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} isDisabled={saving} />

        <ModalBody
          {...modalShell.body}
          {...modalShell.bodyPadded}
          className={`${modalUi.bodyClass} space-y-3`}
        >
          <p className={ui.body}>
            Log an update on this deal. The note is saved to the HubSpot deal timeline.
          </p>
          <textarea
            className={`${ui.inputSurface} resize-y min-h-[140px]`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Log a quick update on this deal…"
            rows={6}
          />
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={`${modalUi.footerClass} !border-t`}>
          <button type="button" className={ui.btnGhost} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={ui.btnPrimary}
            onClick={onSave}
            disabled={saving || !body.trim()}
          >
            {saving ? "Saving…" : "Save to HubSpot"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import TemplateEditorCard from "@/components/campaigns/TemplateEditorCard";
import { CHANNEL_LABELS, validateTemplate } from "@/lib/campaignConstants";
import { modalShell, modalUi, ui } from "@/lib/brandUi";

export default function TemplateEditorModal({
  isOpen,
  onClose,
  template,
  onSave,
  saving = false,
  mode = "create",
}) {
  const [draft, setDraft] = useState(template);

  useEffect(() => {
    if (isOpen && template) setDraft(template);
  }, [isOpen, template]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    const err = validateTemplate(draft);
    if (err) {
      toast.error(err);
      return;
    }
    await onSave?.(draft);
  };

  if (!draft) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      isCentered
      scrollBehavior="inside"
      closeOnOverlayClick={!saving}
      blockScrollOnMount
    >
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent
        {...modalShell.content}
        {...modalShell.contentCentered}
        className={modalUi.contentClass}
      >
        <ModalHeader {...modalShell.header} className={modalUi.headerClass}>
          <p className="text-base font-semibold text-brand-ink">
            {mode === "edit" ? "Edit" : "New"} {CHANNEL_LABELS[draft.channel]} template
          </p>
        </ModalHeader>
        <ModalCloseButton
          isDisabled={saving}
          className={modalUi.closeButtonClass}
        />

        <ModalBody
          {...modalShell.body}
          {...modalShell.bodyPadded}
          className={modalUi.bodyClass}
        >
          <TemplateEditorCard
            template={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            showRemove={false}
          />
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={modalUi.footerClass}>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className={ui.btnSecondarySurface}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={ui.btnPrimary}
          >
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add template"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

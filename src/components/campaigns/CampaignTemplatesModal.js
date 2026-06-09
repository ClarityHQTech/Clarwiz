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
import CampaignTemplatesPanel from "@/components/campaigns/CampaignTemplatesPanel";
import { modalShell, modalUi, ui } from "@/lib/brandUi";
import { TEMPLATE_VARIABLES } from "@/lib/templateVariables";

export default function CampaignTemplatesModal({
  isOpen,
  onClose,
  campaignId,
  templates = [],
  onUpdated,
}) {
  const handleClose = () => onClose();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent
        {...modalShell.content}
        mx={3}
        maxH="92vh"
        className={modalUi.contentClass}
      >
        <ModalHeader {...modalShell.header} className={modalUi.headerClass}>
          <p className="text-base font-semibold text-brand-ink">
            Communication templates
          </p>
          <p className="text-xs font-normal text-brand-stone mt-0.5">
            Select WhatsApp templates from your provider account, or create email and
            LinkedIn stage templates ({TEMPLATE_VARIABLES}).
          </p>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} />

        <ModalBody
          {...modalShell.body}
          {...modalShell.bodyPadded}
          className={`space-y-5 ${modalUi.bodyClass}`}
        >
          <CampaignTemplatesPanel
            campaignId={campaignId}
            templates={templates}
            onUpdated={onUpdated}
          />
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={modalUi.footerClass}>
          <button type="button" onClick={handleClose} className={ui.btnSecondarySurface}>
            Close
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

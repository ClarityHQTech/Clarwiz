"use client";

import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import CollateralLiveEditor from "@/components/assist/collateral/CollateralLiveEditor";
import { modalUi, ui } from "@/lib/brandUi";

export default function CollateralEditorModal({ documentId, title, onClose }) {
  if (!documentId) return null;

  return (
    <Modal isOpen onClose={onClose} size="full" motionPreset="slideInBottom">
      <ModalOverlay className={modalUi.overlayClass} />
      <ModalContent className={`${modalUi.contentClass} !m-0 !rounded-none !max-h-full !h-full flex flex-col`}>
        <ModalHeader
          className={`${modalUi.headerClass} !border-b shrink-0 flex items-center justify-between py-3`}
        >
          <div className="min-w-0 pr-8">
            <p className={`${ui.label} mb-0.5 normal-case tracking-wide font-sans`}>Live editor</p>
            <span className="font-serif text-lg truncate block">{title || "Collateral"}</span>
          </div>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} />
        <ModalBody className={`${modalUi.bodyClass} !p-0 flex-1 min-h-0 overflow-hidden`}>
          <CollateralLiveEditor documentId={documentId} onClose={onClose} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

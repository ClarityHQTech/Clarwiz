"use client";

import Link from "next/link";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { HiOutlineArrowTopRightOnSquare, HiOutlinePencilSquare } from "react-icons/hi2";
import CollateralPreviewFrame from "@/components/assist/collateral/CollateralPreviewFrame";
import { modalUi, ui } from "@/lib/brandUi";
import AssistBadge from "../ui/AssistBadge";
import { TYPE_LABELS, SOURCE_LABELS, CATEGORY_LABELS } from "./constants";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CollateralViewerModal({ item, onClose, onEdit }) {
  if (!item?.externalId) return null;

  const previewUrl = `/api/assist/document/${item.externalId}/html`;

  return (
    <Modal isOpen onClose={onClose} size="full" motionPreset="slideInBottom">
      <ModalOverlay className={modalUi.overlayClass} />
      <ModalContent className={`${modalUi.contentClass} !m-0 !rounded-none !max-h-full !h-full flex flex-col`}>
        <ModalHeader
          className={`${modalUi.headerClass} !border-b shrink-0 flex items-center justify-between py-3`}
        >
          <div className="min-w-0 pr-8">
            <p className={`${ui.label} mb-0.5 normal-case tracking-wide font-sans`}>Created collateral</p>
            <span className="font-serif text-lg truncate block">{item.title || "Collateral"}</span>
          </div>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} />
        <ModalBody className={`${modalUi.bodyClass} !p-0 flex-1 min-h-0 overflow-hidden`}>
          <div className="flex flex-col lg:flex-row h-full min-h-0">
            <aside className="shrink-0 border-b lg:border-b-0 lg:border-r border-brand-secondary/15 bg-brand-bg/50 p-4 lg:w-80 space-y-4 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                <AssistBadge variant="ghost">{TYPE_LABELS[item.type] ?? item.type}</AssistBadge>
                {item.category ? (
                  <AssistBadge variant="ghost">{CATEGORY_LABELS[item.category] ?? item.category}</AssistBadge>
                ) : null}
                <AssistBadge variant="ghost">{SOURCE_LABELS[item.source] ?? item.source}</AssistBadge>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-stone">Created</dt>
                  <dd className="text-brand-ink mt-0.5">{formatDate(item.createdAt)}</dd>
                </div>
                {item.dealName ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-brand-stone">Deal</dt>
                    <dd className="text-brand-ink mt-0.5">
                      {item.dealId ? (
                        <Link href={`/assist/deal/${item.dealId}`} className={ui.link}>
                          {item.dealName}
                        </Link>
                      ) : (
                        item.dealName
                      )}
                      {item.dealStage ? (
                        <span className="block text-xs text-brand-stone mt-0.5">{item.dealStage}</span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {item.companyName ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-brand-stone">Company</dt>
                    <dd className="text-brand-ink mt-0.5">{item.companyName}</dd>
                  </div>
                ) : null}
                {!item.dealName && !item.companyName ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-brand-stone">Association</dt>
                    <dd className="text-brand-stone mt-0.5 text-xs">Not linked to a deal</dd>
                  </div>
                ) : null}
              </dl>

              <div className="flex flex-col gap-2 pt-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ui.btnSecondarySurface} w-full text-xs justify-center`}
                >
                  <HiOutlineArrowTopRightOnSquare className="h-4 w-4" />
                  Open in new tab
                </a>
                {onEdit ? (
                  <button type="button" className={`${ui.btnPrimary} w-full text-xs`} onClick={() => onEdit(item)}>
                    <HiOutlinePencilSquare className="h-4 w-4" />
                    Open in editor
                  </button>
                ) : null}
              </div>
            </aside>

            <div className="flex-1 min-h-0 flex flex-col">
              <CollateralPreviewFrame src={previewUrl} title={item.title || "Collateral preview"} />
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { modalUi, ui } from "@/lib/brandUi";

export default function PromoteButton({ contactId, companyName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultName = `${companyName || "New"} — Opportunity`;
  const [dealname, setDealname] = useState(defaultName);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setDealname(defaultName);
  }, [open, defaultName]);

  const submit = async () => {
    if (!dealname.trim()) {
      toast.error("Deal name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assist/lead/${contactId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealname: dealname.trim(),
          amount: amount.trim() ? Number(amount) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Could not promote this lead");
        return;
      }
      if (data.warning) toast.warning(data.warning);
      toast.success("Deal created");
      setOpen(false);
      router.push(`/assist/deal/${data.dealId}`);
      router.refresh();
    } catch {
      toast.error("Could not promote this lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className={ui.btnPrimary} onClick={() => setOpen(true)}>
        Promote to deal
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} isCentered>
        <ModalOverlay className={modalUi.overlayClass} />
        <ModalContent className={modalUi.contentClass}>
          <ModalHeader className={modalUi.headerClass}>Promote to deal</ModalHeader>
          <ModalCloseButton className={modalUi.closeButtonClass} />
          <ModalBody className={`${modalUi.bodyClass} space-y-4`}>
            <p className={ui.body}>
              Creates a HubSpot deal in the first open stage, associates this contact
              {companyName ? " and company" : ""}, and links it back into Clarwiz.
            </p>
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Deal name</label>
              <input className={ui.inputSurface} value={dealname} onChange={(e) => setDealname(e.target.value)} autoFocus />
            </div>
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Amount (optional)</label>
              <input
                className={ui.inputSurface}
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter className={`${modalUi.footerClass} gap-2`}>
            <button type="button" className={ui.btnSecondary} onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className={ui.btnPrimary} onClick={submit} disabled={submitting}>
              {submitting ? "Creating…" : "Create deal"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

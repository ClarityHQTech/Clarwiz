"use client";

import Link from "next/link";
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

/**
 * AE Assist CRM email — compose and send from the deal page (not campaign channels).
 * Requires Gmail or HubSpot Single Send in Integrations.
 */
export default function CrmEmailModal({ dealId, contacts = [], isOpen, onClose }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [collateralId, setCollateralId] = useState("");
  const [collaterals, setCollaterals] = useState([]);
  const [loadingCollaterals, setLoadingCollaterals] = useState(false);
  const [sending, setSending] = useState(false);
  const [capabilities, setCapabilities] = useState(null);

  const emailOf = (c) => c?.email || c?.businessUser?.email || null;
  const nameOf = (c) => c?.name || c?.businessUser?.name || null;
  const titleOf = (c) => c?.title || c?.businessUser?.jobTitle || null;
  const emailable = useMemo(
    () => (contacts || []).filter((c) => c?.id && emailOf(c)),
    [contacts]
  );

  useEffect(() => {
    if (!isOpen) return;
    const primary = emailable[0];
    setSelectedIds(primary ? [primary.id] : []);
    setSubject("");
    setBody("");
    setCollateralId("");
  }, [isOpen, dealId, emailable]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      setLoadingCollaterals(true);
      try {
        const [capRes, colRes] = await Promise.all([
          fetch("/api/assist/crm-email/capabilities"),
          fetch("/api/assist/collateral"),
        ]);
        const capData = await capRes.json().catch(() => ({}));
        const colData = await colRes.json().catch(() => ({}));
        if (cancelled) return;
        setCapabilities(capData.capabilities ?? null);
        const items = Array.isArray(colData.items) ? colData.items : [];
        setCollaterals(items.filter((item) => item.externalId));
      } catch {
        if (!cancelled) toast.error("Could not load CRM email settings");
      } finally {
        if (!cancelled) setLoadingCollaterals(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const toggleRecipient = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    if (!selectedIds.length) {
      toast.error("Select at least one recipient");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/crm-email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          recipientContactIds: selectedIds,
          ...(collateralId ? { collateralId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect Gmail or HubSpot Single Send in Integrations to send CRM email.");
        return;
      }
      if (res.status === 503 && data.error === "pdf_renderer_unavailable") {
        toast.error("PDF renderer unavailable on server — contact your admin.");
        return;
      }
      if (!res.ok || data.ok === false) {
        toast.error(data.reason || data.error || "Send failed");
        return;
      }
      if (data.delivered) {
        const via =
          data.deliveryChannel === "gmail"
            ? "Gmail"
            : data.deliveryChannel === "hubspot_single_send"
              ? "HubSpot"
              : "email";
        const attachNote =
          data.attachmentCount > 0 ? ` · ${data.attachmentCount} PDF attached` : "";
        toast.success(`CRM email sent via ${via} (logged in HubSpot)${attachNote}`);
      } else {
        toast.success("Logged to HubSpot timeline — connect Gmail to deliver from your mailbox");
      }
      onClose?.();
    } catch {
      toast.error("Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="2xl"
      scrollBehavior="inside"
      closeOnOverlayClick={!sending}
    >
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent
        {...modalShell.content}
        {...modalShell.contentCentered}
        maxW="3xl"
        className={`${modalUi.contentClass} !flex !flex-col`}
      >
        <ModalHeader {...modalShell.header} className={`${modalUi.headerClass} !border-b`}>
          <p className={`${ui.label} mb-1 normal-case tracking-wide font-sans`}>
            AE Assist · CRM email
          </p>
          <span className="font-serif text-lg">Send email</span>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} isDisabled={sending} />

        <ModalBody
          {...modalShell.body}
          {...modalShell.bodyPadded}
          minH={0}
          overflowY="auto"
          className={`${modalUi.bodyClass} !min-h-0 !overflow-y-auto space-y-4`}
        >
          <p className={ui.body}>
            Compose a one-off email for this deal. This is separate from campaign outreach channels.
            {capabilities?.deliveryHint
              ? ` Delivery via ${capabilities.deliveryHint}.`
              : " Connect Gmail in Integrations to enable sending."}
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`${ui.label} normal-case tracking-normal`}>To</label>
              <span className="text-xs text-brand-stone">{selectedIds.length} selected</span>
            </div>
            {!(contacts || []).length ? (
              <p className={ui.body}>No people on this deal.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(contacts || []).map((c) => {
                  const email = emailOf(c);
                  const hasEmail = !!email;
                  const selected = selectedIds.includes(c.id);
                  return (
                    <button
                      key={c.id || email}
                      type="button"
                      onClick={() => hasEmail && toggleRecipient(c.id)}
                      disabled={!hasEmail}
                      aria-pressed={selected}
                      title={hasEmail ? email : "No email on file"}
                      className={`inline-flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        !hasEmail
                          ? "cursor-not-allowed opacity-50 border-brand-secondary/25 bg-brand-bg"
                          : selected
                            ? "border-brand-terracotta/50 bg-brand-terracotta/10 text-brand-ink"
                            : "border-brand-secondary/30 bg-brand-surface text-brand-ink hover:bg-brand-bg"
                      }`}
                    >
                      <span
                        className={`text-xs font-semibold ${selected ? "text-brand-terracotta" : ""}`}
                      >
                        {selected ? "✓ " : ""}
                        {nameOf(c) || email || "Contact"}
                        {titleOf(c) ? ` · ${titleOf(c)}` : ""}
                      </span>
                      <span className="text-[11px] text-brand-stone">
                        {hasEmail ? email : "no email"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Subject</label>
            <input
              className={ui.inputSurface}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Message</label>
            <textarea
              className={`${ui.inputSurface} resize-y min-h-[160px]`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email…"
              rows={8}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className={`${ui.label} normal-case tracking-normal`}>
                Attach collateral (PDF)
              </label>
              <Link href="/collaterals" className={`${ui.link} text-xs`} target="_blank">
                Open collaterals →
              </Link>
            </div>
            {loadingCollaterals ? (
              <p className="text-xs text-brand-stone">Loading collaterals…</p>
            ) : (
              <select
                value={collateralId}
                onChange={(e) => setCollateralId(e.target.value)}
                className={ui.inputSurface}
              >
                <option value="">No attachment</option>
                {collaterals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.isTemplate ? " (template)" : ""}
                    {item.type ? ` · ${item.type.replace(/_/g, " ")}` : ""}
                  </option>
                ))}
              </select>
            )}
            {collateralId ? (
              <p className="text-xs text-brand-stone mt-1">
                Collateral is converted to PDF before sending.
                {capabilities?.gmailConnected
                  ? " Attached to the email."
                  : " Linked in the email body (Single Send)."}
              </p>
            ) : null}
          </div>
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={`${modalUi.footerClass} !border-t flex-wrap`}>
          <button type="button" className={ui.btnGhost} onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            className={ui.btnPrimary}
            onClick={send}
            disabled={sending || !selectedIds.length || !subject.trim() || !body.trim()}
          >
            {sending ? "Sending…" : "Send CRM email →"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

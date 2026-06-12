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
import CollateralEditorModal from "@/components/assist/collateral/CollateralEditorModal";
import { stripCollateralViewerLinks } from "@/lib/assist/stripCollateralViewerLinks";
import { modalShell, modalUi, ui } from "@/lib/brandUi";

/**
 * Email compose modal for an NBA (Chakra + brand UI).
 *
 * Flow:
 *  1. On open with no existing draft, POSTs the execute endpoint to draft the email.
 *  2. Renders an editable subject + HTML body with a live preview.
 *  3. "Save draft" copies the draft to the clipboard.
 *  4. "Send" POSTs { subject, html, recipientContactIds } — Gmail first, then HubSpot fallback; always logs to CRM.
 */
export default function EmailModal({ dealId, nba, contacts = [], isOpen, onClose, onExecuted }) {
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [documentId, setDocumentId] = useState(null);
  const [collateralTitle, setCollateralTitle] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const emailOf = (c) => c?.email || c?.businessUser?.email || null;
  const nameOf = (c) => c?.name || c?.businessUser?.name || null;
  const titleOf = (c) => c?.title || c?.businessUser?.jobTitle || null;
  const emailable = (contacts || []).filter((c) => c?.id && emailOf(c));

  useEffect(() => {
    if (!isOpen) return;
    const primary = emailable[0];
    setSelectedIds(primary ? [primary.id] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nba?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const existing = nba?.draftPayload;
    if (existing?.emailHtml) {
      setSubject(existing.subject || "");
      setHtml(stripCollateralViewerLinks(existing.emailHtml || ""));
      setDrafted(true);
      setDocumentId(existing.documentId || null);
      setCollateralTitle(existing.collateralTitle || "");
    } else {
      setSubject("");
      setHtml("");
      setDrafted(false);
      setDocumentId(null);
      setCollateralTitle("");
    }
  }, [isOpen, nba]);

  const toggleRecipient = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const runDraft = async () => {
    setDrafting(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/nba/${nba.id}/execute`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast.error(data.reason || data.error || "Drafting failed");
        return;
      }
      setSubject(data.draft?.subject || "");
      setHtml(stripCollateralViewerLinks(data.draft?.emailHtml || ""));
      setDrafted(true);
      setDocumentId(data.draft?.documentId || null);
      setCollateralTitle(data.draft?.collateralTitle || "");
      toast.success(data.alreadyExecuted ? "Loaded existing draft" : "Email drafted");
      onExecuted?.();
    } catch {
      toast.error("Drafting failed");
    } finally {
      setDrafting(false);
    }
  };

  const saveDraft = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${html}`);
      toast.success("Draft copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const send = async () => {
    if (!subject.trim() || !html.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    if (!selectedIds.length) {
      toast.error("Select at least one recipient");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/nba/${nba.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html,
          recipientContactIds: selectedIds,
          ...(documentId ? { documentId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Integrations to send email.");
        return;
      }
      if (!res.ok || data.ok === false) {
        toast.error(data.reason || data.error || "Send failed");
        return;
      }
      if (data.delivered) {
        const n = data.sent ?? data.recipientCount ?? 1;
        const via =
          data.deliveryChannel === "gmail"
            ? "Gmail"
            : data.deliveryChannel === "hubspot_single_send"
              ? "HubSpot"
              : "email";
        toast.success(`Sent to ${n} via ${via} (logged in HubSpot)`);
      } else {
        toast.success("Logged to HubSpot timeline — connect Gmail in Assist Settings to deliver");
      }
      onExecuted?.();
      onClose?.();
    } catch {
      toast.error("Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        isCentered
        size="2xl"
        scrollBehavior="inside"
        closeOnOverlayClick={!drafting && !sending}
      >
        <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
        <ModalContent
          {...modalShell.content}
          {...modalShell.contentCentered}
          maxW="3xl"
          className={`${modalUi.contentClass} !flex !flex-col`}
        >
          <ModalHeader {...modalShell.header} className={`${modalUi.headerClass} !border-b`}>
            <p className={`${ui.label} mb-1 normal-case tracking-wide font-sans`}>NBA · Editable draft</p>
            <span className="font-serif text-lg">{nba?.title || "Next best action"}</span>
          </ModalHeader>
          <ModalCloseButton className={modalUi.closeButtonClass} isDisabled={drafting || sending} />

          <ModalBody
            {...modalShell.body}
            {...modalShell.bodyPadded}
            minH={0}
            overflowY="auto"
            className={`${modalUi.bodyClass} !min-h-0 !overflow-y-auto space-y-4`}
          >
            {nba?.rationale ? <p className={ui.body}>{nba.rationale}</p> : null}

            {!drafted ? (
              <div className="py-10 text-center">
                <p className={`${ui.body} mb-4`}>Generate a draft email for this action.</p>
                <button type="button" className={ui.btnPrimary} onClick={runDraft} disabled={drafting}>
                  {drafting ? "Drafting…" : "Draft email →"}
                </button>
              </div>
            ) : (
              <>
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
                            <span className={`text-xs font-semibold ${selected ? "text-brand-terracotta" : ""}`}>
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
                  <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Body · HTML</label>
                  <textarea
                    className={`${ui.inputSurface} font-mono text-xs leading-relaxed resize-y min-h-[160px] max-h-[280px] overflow-y-auto block`}
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    rows={10}
                  />
                </div>

                {documentId ? (
                  <div className={`${ui.cardSurface} p-3 flex items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <p className={`${ui.label} mb-0.5 normal-case tracking-normal`}>Collateral attached</p>
                      <p className="text-sm font-medium text-brand-ink truncate" title={collateralTitle}>
                        {collateralTitle || "Generated asset"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${ui.btnSecondarySurface} shrink-0`}
                      onClick={() => setEditorOpen(true)}
                    >
                      View / edit →
                    </button>
                  </div>
                ) : null}

                <div>
                  <p className={`${ui.label} mb-2 normal-case tracking-normal`}>Preview</p>
                  <div
                    className="rounded-lg border border-brand-secondary/30 bg-white p-4 text-sm text-brand-ink leading-relaxed prose prose-sm max-w-none max-h-[240px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              </>
            )}
          </ModalBody>

          <ModalFooter {...modalShell.footer} className={`${modalUi.footerClass} !border-t flex-wrap`}>
            <p className={`${ui.label} normal-case tracking-normal mr-auto`}>
              {drafted ? "Editable · not yet sent" : "No draft yet"}
            </p>
            {drafted ? (
              <button type="button" className={ui.btnGhost} onClick={runDraft} disabled={drafting || sending}>
                {drafting ? "…" : "Re-draft"}
              </button>
            ) : null}
            <button type="button" className={ui.btnSecondary} onClick={saveDraft} disabled={!drafted || sending}>
              Save draft
            </button>
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={send}
              disabled={!drafted || sending || !selectedIds.length}
            >
              {sending ? "Sending…" : "Send email →"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {editorOpen && documentId ? (
        <CollateralEditorModal
          documentId={documentId}
          title={collateralTitle}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}
    </>
  );
}

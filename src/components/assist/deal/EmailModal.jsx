"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import CollateralEditorModal from "@/components/assist/collateral/CollateralEditorModal";

/**
 * Cockpit email compose modal for an NBA.
 *
 * Flow:
 *  1. On open with no existing draft, POSTs the execute endpoint to draft the
 *     email (existing route, unchanged).
 *  2. Renders an editable subject + HTML body with a live preview.
 *  3. "Save draft" copies the draft to the clipboard (no destructive call).
 *  4. "Send via HubSpot" POSTs { subject, html } to
 *     POST /api/assist/deal/[dealId]/nba/[nbaId]/send — a route built by another
 *     agent — and toasts the result.
 *
 * Props: { dealId, nba, contacts, isOpen, onClose, onExecuted }
 *
 * `contacts` is the deal's people (vm.contacts): { id, email, name, title }.
 * The AE picks which of them the email goes to via a multi-select "To" field;
 * the selected Contact ids are sent to the route, which logs one email and
 * associates it to every selected contact's HubSpot timeline.
 */
export default function EmailModal({ dealId, nba, contacts = [], isOpen, onClose, onExecuted }) {
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [drafted, setDrafted] = useState(false);
  // Attached collateral (set by the execute route when the NBA needs an asset).
  const [documentId, setDocumentId] = useState(null);
  const [collateralTitle, setCollateralTitle] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  // Selected recipient Contact ids (multi-select "To").
  const [selectedIds, setSelectedIds] = useState([]);

  // Email / name / title live on the linked BusinessUser, not the Contact row.
  const emailOf = (c) => c?.email || c?.businessUser?.email || null;
  const nameOf = (c) => c?.name || c?.businessUser?.name || null;
  const titleOf = (c) => c?.title || c?.businessUser?.jobTitle || null;

  // Contacts that can actually be emailed (have an address).
  const emailable = (contacts || []).filter((c) => c?.id && emailOf(c));

  // Default-select the primary contact = first contact with an email.
  useEffect(() => {
    if (!isOpen) return;
    const primary = emailable[0];
    setSelectedIds(primary ? [primary.id] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nba?.id]);

  const toggleRecipient = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    const existing = nba?.draftPayload;
    if (existing?.emailHtml) {
      setSubject(existing.subject || "");
      setHtml(existing.emailHtml || "");
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
      setHtml(data.draft?.emailHtml || "");
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
        body: JSON.stringify({ subject, html, recipientContactIds: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Settings to send email.");
        return;
      }
      if (!res.ok || data.ok === false) {
        toast.error(data.reason || data.error || "Send failed");
        return;
      }
      if (data.delivered) {
        const n = data.sent ?? data.recipientCount ?? 1;
        toast.success(`Sent to ${n} via HubSpot`);
      } else {
        toast.success("Logged to HubSpot timeline (configure Single Send to deliver)");
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
    <div className="ck-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="ck-email-frame" role="dialog" aria-label="Compose email">
        <div className="ck-email-header">
          <div>
            <div className="ck-email-eyebrow">NBA · Editable Draft</div>
            <div className="ck-email-title">{nba?.title || "Next best action"}</div>
          </div>
          <button
            type="button"
            className="ck-drawer-close"
            style={{ position: "relative", top: 0, right: 0 }}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="ck-email-body">
          {nba?.rationale && <div className="ck-risk-desc" style={{ marginBottom: 16 }}>{nba.rationale}</div>}

          {!drafted ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p className="ck-risk-desc" style={{ marginBottom: 16 }}>
                Generate a draft email for this action.
              </p>
              <button type="button" className="ck-btn ck-btn-primary" onClick={runDraft} disabled={drafting}>
                {drafting ? "Drafting…" : "Draft email →"}
              </button>
            </div>
          ) : (
            <>
              <div className="ck-email-field">
                <div className="lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>To</span>
                  <span className="ck-email-eyebrow" style={{ textTransform: "none" }}>
                    {selectedIds.length} selected
                  </span>
                </div>
                {!(contacts || []).length ? (
                  <div className="ck-risk-desc" style={{ fontSize: 12 }}>
                    No people on this deal.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
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
                          style={{
                            cursor: hasEmail ? "pointer" : "not-allowed",
                            opacity: hasEmail ? 1 : 0.5,
                            display: "inline-flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 2,
                            textAlign: "left",
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: selected ? "var(--accent-soft)" : "var(--elevated)",
                            border: `1px solid ${selected ? "var(--accent-line)" : "var(--line)"}`,
                            color: "var(--text)",
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--accent)" : "var(--text)" }}>
                            {selected ? "✓ " : ""}
                            {nameOf(c) || email || "Contact"}
                            {titleOf(c) ? ` · ${titleOf(c)}` : ""}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            {hasEmail ? email : "no email"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="ck-email-field" style={{ marginTop: 16 }}>
                <div className="lbl">Subject</div>
                <input
                  className="ck-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="ck-email-eyebrow" style={{ marginBottom: 6 }}>Body · HTML</div>
                <textarea
                  className="ck-textarea"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  rows={10}
                />
              </div>

              {documentId && (
                <div
                  className="ck-card"
                  style={{
                    marginTop: 16,
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="ck-email-eyebrow" style={{ marginBottom: 2 }}>
                      📎 Collateral attached
                    </div>
                    <div
                      style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={collateralTitle}
                    >
                      {collateralTitle || "Generated asset"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ck-btn ck-btn-ghost"
                    style={{ flexShrink: 0 }}
                    onClick={() => setEditorOpen(true)}
                  >
                    View / edit →
                  </button>
                </div>
              )}

              <div className="ck-email-eyebrow" style={{ marginTop: 16, marginBottom: 6 }}>Preview</div>
              <div className="ck-email-preview" dangerouslySetInnerHTML={{ __html: html }} />
            </>
          )}
        </div>

        <div className="ck-email-footer">
          <div className="ck-email-footer-meta">
            {drafted ? "Editable · not yet sent" : "No draft yet"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {drafted && (
              <button type="button" className="ck-btn ck-btn-ghost" onClick={runDraft} disabled={drafting}>
                {drafting ? "…" : "Re-draft"}
              </button>
            )}
            <button type="button" className="ck-btn" onClick={saveDraft} disabled={!drafted}>
              Save draft
            </button>
            <button
              type="button"
              className="ck-btn ck-btn-primary"
              onClick={send}
              disabled={!drafted || sending || !selectedIds.length}
            >
              {sending ? "Sending…" : "Send via HubSpot →"}
            </button>
          </div>
        </div>
      </div>

      {editorOpen && documentId && (
        <CollateralEditorModal
          documentId={documentId}
          title={collateralTitle}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CkBadge } from "../cockpit/primitives";

const EMPTY = { dealId: "", accountId: "", nbaId: "", title: "" };

function scoreVariant(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return "ghost";
  if (n >= 80) return "ok";
  if (n >= 50) return "warn";
  return "danger";
}

/**
 * "Generate with AI" modal (cockpit). POSTs /api/assist/collateral/generate with
 * a deal / account / nba reference (unchanged), then fetches the stored Document
 * and shows a read-only preview of the compliance score + template/data.
 */
export default function GenerateCollateralModal({ isOpen, onClose, onGenerated }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { compliance, document }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    setForm(EMPTY);
    setResult(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = async () => {
    if (!form.dealId.trim() && !form.accountId.trim() && !form.nbaId.trim()) {
      toast.error("Provide a deal, account, or NBA id");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assist/collateral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: form.dealId.trim() || undefined,
          accountId: form.accountId.trim() || undefined,
          nbaId: form.nbaId.trim() || undefined,
          title: form.title.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === "generation_failed"
            ? "AI generation failed — try again"
            : data.error === "anthropic_not_configured" || data.error === "integration_missing"
              ? "Collateral generation isn't set up for this workspace yet"
              : data.error || "Could not generate collateral";
        toast.error(msg);
        return;
      }
      toast.success("Collateral generated");
      onGenerated?.({ collateralId: data.collateralId, documentId: data.documentId });

      let docResult = null;
      try {
        const docRes = await fetch(`/api/assist/document/${data.documentId}`);
        if (docRes.ok) docResult = (await docRes.json()).document;
      } catch {
        /* preview is best-effort */
      }
      setResult({ compliance: data.compliance, document: docResult });
    } catch {
      toast.error("Could not generate collateral");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const Field = ({ label, k, placeholder, hint }) => (
    <div>
      <div className="ck-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <input className="ck-input" value={form[k]} onChange={set(k)} placeholder={placeholder} />
      {hint && <div className="ck-collateral-meta" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );

  return (
    <div className="ck-modal" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="ck-email-frame" role="dialog" aria-label="Generate collateral">
        <div className="ck-email-header">
          <div className="ck-email-title">Generate collateral with AI</div>
          <button
            type="button"
            className="ck-drawer-close"
            style={{ position: "relative", top: 0, right: 0 }}
            onClick={close}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="ck-email-body">
          {!result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p className="ck-risk-desc">
                Reference a deal, account, or next best action. AURA builds an on-brand one-pager
                from your company + prospect data.
              </p>
              <Field label="Deal id" k="dealId" placeholder="optional" />
              <Field label="Account id" k="accountId" placeholder="optional" />
              <Field label="NBA id" k="nbaId" placeholder="optional" hint="At least one of deal / account / NBA is required." />
              <Field label="Title" k="title" placeholder="optional override" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Compliance</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <CkBadge variant={scoreVariant(result.compliance?.score)}>
                    {result.compliance?.score ?? "—"}
                  </CkBadge>
                  <span className="ck-risk-desc">{result.compliance?.note}</span>
                </div>
              </div>

              {result.document && (
                <>
                  <div className="ck-section-title">Template (read-only)</div>
                  <pre className="ck-textarea" style={{ maxHeight: 200, overflow: "auto", margin: 0 }}>
                    {result.document.template || "(empty)"}
                  </pre>
                  <div className="ck-section-title">Data</div>
                  <pre className="ck-textarea" style={{ maxHeight: 200, overflow: "auto", margin: 0 }}>
                    {JSON.stringify(result.document.data ?? {}, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>

        <div className="ck-email-footer">
          <div className="ck-email-footer-meta" />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ck-btn ck-btn-ghost" onClick={close} disabled={submitting}>
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button type="button" className="ck-btn ck-btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? "Generating…" : "Generate with AI"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

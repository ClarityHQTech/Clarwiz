"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TYPE_OPTIONS, SOURCE_OPTIONS, STAGE_OPTIONS } from "./constants";

const EMPTY = {
  title: "",
  type: "ONE_PAGER",
  source: "UPLOAD",
  funnelStage: "ANY",
  url: "",
  slug: "",
  tags: "",
  companyHsId: "",
  dealHsId: "",
};

/**
 * "Register collateral" modal (cockpit). POSTs to /api/assist/collateral
 * (unchanged). Requires a link (url) OR a slug — mirrors the route's
 * `link_or_slug_required` rule.
 */
export default function RegisterModal({ isOpen, onClose, onRegistered }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    setForm(EMPTY);
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
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.url.trim() && !form.slug.trim()) {
      toast.error("Provide a link or a slug");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assist/collateral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          source: form.source,
          funnelStage: form.funnelStage,
          url: form.url.trim() || undefined,
          slug: form.slug.trim() || undefined,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          companyHsId: form.companyHsId.trim() || undefined,
          dealHsId: form.dealHsId.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not register collateral");
        return;
      }
      toast.success("Collateral registered");
      onRegistered?.(data.item);
      close();
    } catch {
      toast.error("Could not register collateral");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const Field = ({ label, k, placeholder, hint, autoFocus }) => (
    <div>
      <div className="ck-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <input className="ck-input" value={form[k]} onChange={set(k)} placeholder={placeholder} autoFocus={autoFocus} />
      {hint && <div className="ck-collateral-meta" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );

  const SelectField = ({ label, k, options }) => (
    <div>
      <div className="ck-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <select className="ck-input" value={form[k]} onChange={set(k)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="ck-modal" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="ck-email-frame" role="dialog" aria-label="Register collateral">
        <div className="ck-email-header">
          <div className="ck-email-title">Register collateral</div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Title" k="title" autoFocus />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <SelectField label="Type" k="type" options={TYPE_OPTIONS} />
              <SelectField label="Source" k="source" options={SOURCE_OPTIONS} />
              <SelectField label="Funnel stage" k="funnelStage" options={STAGE_OPTIONS} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Slug" k="slug" placeholder="q2-pricing-onepager" hint="HeyParrot viewer slug" />
              <Field label="Link (URL)" k="url" placeholder="https://…" hint="Used when no slug" />
            </div>
            <Field label="Tags" k="tags" placeholder="fintech, cfo, security" hint="Comma-separated; powers best-match ranking" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Company HubSpot ID" k="companyHsId" placeholder="optional" />
              <Field label="Deal HubSpot ID" k="dealHsId" placeholder="optional" />
            </div>
          </div>
        </div>

        <div className="ck-email-footer">
          <div className="ck-email-footer-meta" />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ck-btn ck-btn-ghost" onClick={close} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className="ck-btn ck-btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? "Registering…" : "Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

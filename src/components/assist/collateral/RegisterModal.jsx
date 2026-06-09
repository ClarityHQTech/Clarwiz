"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TYPE_OPTIONS, CATEGORY_OPTIONS, STAGE_OPTIONS } from "./constants";

const EMPTY = {
  title: "",
  category: "SALES",
  type: "ONE_PAGER",
  funnelStage: "ANY",
  html: "",
  url: "",
  tags: "",
};

/**
 * "Register collateral" modal (cockpit) — the brand-template upload path.
 * Paste the collateral's HTML (brand colors baked in) and categorize it as
 * Marketing or Sales. POSTs to /api/assist/collateral, which stores the markup
 * as a Document + an isTemplate CollateralIndex row. An optional external URL is
 * supported for link-only assets (no HTML).
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
    if (!form.html.trim() && !form.url.trim()) {
      toast.error("Paste HTML content or provide an external URL");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assist/collateral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          type: form.type,
          funnelStage: form.funnelStage,
          html: form.html.trim() || undefined,
          url: form.url.trim() || undefined,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not register template");
        return;
      }
      toast.success(form.html.trim() ? "Template registered" : "Collateral registered");
      onRegistered?.(data.item);
      close();
    } catch {
      toast.error("Could not register template");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ck-modal" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="ck-email-frame" role="dialog" aria-label="Register collateral template">
        <div className="ck-email-header">
          <div className="ck-email-title">Register brand template</div>
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
            <div>
              <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Title</div>
              <input
                className="ck-input"
                value={form.title}
                onChange={set("title")}
                placeholder="Sales one-pager"
                autoFocus
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Category</div>
                <select className="ck-input" value={form.category} onChange={set("category")}>
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Type</div>
                <select className="ck-input" value={form.type} onChange={set("type")}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Funnel stage</div>
                <select className="ck-input" value={form.funnelStage} onChange={set("funnelStage")}>
                  {STAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="ck-eyebrow" style={{ marginBottom: 6 }}>HTML content</div>
              <textarea
                className="ck-input"
                value={form.html}
                onChange={set("html")}
                placeholder={"<!DOCTYPE html><html>…paste your on-brand template markup, with {{prospect_*}} placeholders…</html>"}
                rows={12}
                style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, resize: "vertical", minHeight: 200 }}
              />
              <div className="ck-collateral-meta" style={{ marginTop: 4 }}>
                The pasted markup becomes an editable brand template. Bake brand colors in; use
                {" "}<code>{"{{prospect_name}}"}</code>-style placeholders for personalization.
              </div>
            </div>

            <div>
              <div className="ck-eyebrow" style={{ marginBottom: 6 }}>External URL (optional)</div>
              <input
                className="ck-input"
                value={form.url}
                onChange={set("url")}
                placeholder="https://… (use when linking an external asset instead of pasting HTML)"
              />
            </div>

            <div>
              <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Tags</div>
              <input
                className="ck-input"
                value={form.tags}
                onChange={set("tags")}
                placeholder="fintech, cfo, security"
              />
              <div className="ck-collateral-meta" style={{ marginTop: 4 }}>
                Comma-separated; powers best-match ranking.
              </div>
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
              {submitting ? "Registering…" : "Register template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

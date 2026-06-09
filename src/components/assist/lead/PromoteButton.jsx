"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * "Demo booked → Promote to Deal" (cockpit). Opens a modal pre-filled with a
 * deal name, optional amount, POSTs to the promote route (unchanged), then
 * routes to the newly created deal workroom.
 */
export default function PromoteButton({ contactId, companyName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultName = `${companyName || "New"} — Opportunity`;
  const [dealname, setDealname] = useState(defaultName);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openModal = () => {
    setDealname(defaultName);
    setAmount("");
    setOpen(true);
  };

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
      <button type="button" className="ck-btn ck-btn-primary" onClick={openModal}>
        Promote to Deal →
      </button>

      {open && (
        <div className="ck-modal" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="ck-email-frame" style={{ width: 520 }} role="dialog" aria-label="Promote to deal">
            <div className="ck-email-header">
              <div className="ck-email-title">Promote to Deal</div>
              <button
                type="button"
                className="ck-drawer-close"
                style={{ position: "relative", top: 0, right: 0 }}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="ck-email-body">
              <p className="ck-risk-desc" style={{ marginBottom: 16 }}>
                Creates a HubSpot deal in the first open stage, associates this contact
                {companyName ? " and company" : ""}, and links it back into Clarwiz.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Deal name</div>
                  <input className="ck-input" value={dealname} onChange={(e) => setDealname(e.target.value)} autoFocus />
                </div>
                <div>
                  <div className="ck-eyebrow" style={{ marginBottom: 6 }}>Amount (optional)</div>
                  <input
                    className="ck-input"
                    type="number"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="ck-email-footer">
              <div className="ck-email-footer-meta" />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="ck-btn ck-btn-ghost" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="button" className="ck-btn ck-btn-primary" onClick={submit} disabled={submitting}>
                  {submitting ? "Creating…" : "Create deal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

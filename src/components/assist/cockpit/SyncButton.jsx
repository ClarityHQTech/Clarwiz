"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const ERROR_COPY = {
  mofu_not_configured: "Connect HubSpot in Settings first.",
  hubspot_auth: "HubSpot rejected the saved token — re-check it in Settings.",
  sync_failed: "Sync failed. Please try again.",
};

/**
 * Cockpit-styled HubSpot sync button. POSTs /api/assist/sync, toasts counts,
 * then refreshes the server component. Exposes `onDone` so the topbar icon can
 * share the spinner state. `variant`: primary | ghost.
 */
export default function SyncButton({ children = "Sync HubSpot", variant = "primary" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onSync = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assist/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(ERROR_COPY[data.error] || "Sync failed");
        return;
      }
      const c = data.counts || {};
      const parts = Object.entries(c)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => `${v} ${k}`);
      toast.success(parts.length ? `Synced ${parts.join(" · ")}` : "Sync complete");
      router.refresh();
    } catch {
      toast.error("Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`ck-btn ${variant === "primary" ? "ck-btn-primary" : "ck-btn-ghost"}`}
      onClick={onSync}
      disabled={loading}
    >
      <span className={loading ? "ck-spin" : undefined} style={{ display: "grid" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </span>
      {loading ? "Syncing…" : children}
    </button>
  );
}

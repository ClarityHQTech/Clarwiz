"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlineArrowPath } from "react-icons/hi2";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

const ERROR_COPY = {
  mofu_not_configured: "Connect HubSpot in Settings first.",
  hubspot_auth: "HubSpot rejected the saved token — re-check it in Settings.",
  sync_failed: "Sync failed. Please try again.",
};

/**
 * HubSpot sync button. POSTs /api/assist/sync, toasts counts, then refreshes.
 */
export default function SyncButton({ children = "Sync HubSpot", className = "" }) {
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
      className={`${ui.btnSecondarySurface} disabled:opacity-50 ${className}`}
      onClick={onSync}
      disabled={loading}
    >
      <HiOutlineArrowPath className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing…" : children}
    </button>
  );
}

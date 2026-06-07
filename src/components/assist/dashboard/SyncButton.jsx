"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@chakra-ui/react";
import { FiRefreshCw } from "react-icons/fi";
import { toast } from "sonner";

const ERROR_COPY = {
  mofu_not_configured: "Connect HubSpot in Settings first.",
  hubspot_auth: "HubSpot rejected the saved token — re-check it in Settings.",
  sync_failed: "Sync failed. Please try again.",
};

/**
 * Triggers POST /api/assist/sync, toasts the resulting counts, then refreshes
 * the server component so the freshly-hydrated graph renders.
 */
export default function SyncButton({ children = "Sync from HubSpot", variant = "solid", size = "sm" }) {
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
    <Button
      onClick={onSync}
      isLoading={loading}
      loadingText="Syncing…"
      colorScheme="orange"
      variant={variant}
      size={size}
      leftIcon={<FiRefreshCw />}
    >
      {children}
    </Button>
  );
}

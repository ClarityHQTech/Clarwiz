"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Cockpit-styled recompute button. Triggers F2 recompute for a deal or account,
 * then refreshes the server component. `scope`: "deal" | "account".
 */
export default function RecomputeButton({ id, scope = "deal", label = "Recompute", variant = "ghost" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const url =
        scope === "account"
          ? `/api/assist/account/${id}/recompute`
          : `/api/assist/deal/${id}/recompute`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast.error(data.error || "Recompute failed");
        return;
      }
      toast.success("Intelligence refreshed");
      router.refresh();
    } catch {
      toast.error("Recompute failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`ck-btn ${variant === "primary" ? "ck-btn-primary" : "ck-btn-ghost"}`}
      onClick={onClick}
      disabled={loading}
    >
      <span className={loading ? "ck-spin" : undefined} style={{ display: "grid" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </span>
      {loading ? "Computing…" : label}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlineArrowPath } from "react-icons/hi2";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

export default function RecomputeButton({ id, scope = "deal", label = "Recompute", primary = false }) {
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
      const summary = data.summary;
      const parts = [];
      if (summary?.signals > 0) parts.push(`${summary.signals} signal${summary.signals === 1 ? "" : "s"}`);
      if (summary?.nbas > 0) parts.push(`${summary.nbas} NBA${summary.nbas === 1 ? "" : "s"}`);
      if (summary?.insight) parts.push("briefing");
      if (parts.length) {
        toast.success(`Intelligence refreshed — ${parts.join(", ")}`);
      } else if (summary?.errors?.length) {
        toast.error(summary.errors.join("; "));
      } else {
        toast.warning("No signals or actions were generated — check outreach history and try again.");
      }
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
      className={primary ? ui.btnPrimary : ui.btnSecondarySurface}
      onClick={onClick}
      disabled={loading}
    >
      <HiOutlineArrowPath className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Computing…" : label}
    </button>
  );
}

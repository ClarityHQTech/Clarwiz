"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";

export default function TenantSwitcher({ collapsed = false }) {
  const user = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!user?.memberships?.length || user.memberships.length <= 1) {
    return null;
  }

  const handleChange = async (e) => {
    const tenantId = e.target.value;
    if (!tenantId || tenantId === user.tenantId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to switch workspace");
        return;
      }
      router.refresh();
      window.location.reload();
    } catch {
      toast.error("Failed to switch workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full px-2 mb-2 ${collapsed ? "hidden" : ""}`}>
      <label className="text-xs text-gray-300 block mb-1">Workspace</label>
      <select
        value={user.tenantId || ""}
        onChange={handleChange}
        disabled={loading}
        className="w-full text-sm rounded-md bg-sky-900 text-white border border-sky-600 px-2 py-1.5"
      >
        {user.memberships.map((m) => (
          <option key={m.tenantId} value={m.tenantId}>
            {m.tenantName}
          </option>
        ))}
      </select>
    </div>
  );
}

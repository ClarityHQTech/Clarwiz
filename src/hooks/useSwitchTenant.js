"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useSwitchTenant() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const switchTenant = async (tenantId, currentTenantId, { redirectTo } = {}) => {
    if (!tenantId || tenantId === currentTenantId) {
      if (redirectTo) {
        window.location.href = redirectTo;
      }
      return Boolean(redirectTo);
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402) {
          toast.error(
            data.message || "This workspace requires an active subscription."
          );
        } else {
          toast.error(data.error || "Failed to switch workspace");
        }
        return false;
      }
      if (redirectTo) {
        window.location.href = redirectTo;
        return true;
      }
      router.refresh();
      window.location.reload();
      return true;
    } catch {
      toast.error("Failed to switch workspace");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { switchTenant, loading };
}

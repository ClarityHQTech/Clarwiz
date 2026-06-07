"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@chakra-ui/react";
import { toast } from "sonner";

/** Triggers F2 recompute for the deal, then refreshes the server component. */
export default function RecomputeButton({ dealId, label = "Recompute", ...props }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/recompute`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast.error(data.error || "Recompute failed");
        return;
      }
      toast.success("Deal intelligence refreshed");
      router.refresh();
    } catch {
      toast.error("Recompute failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button colorScheme="orange" onClick={onClick} isLoading={loading} {...props}>
      {label}
    </Button>
  );
}

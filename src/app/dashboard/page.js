"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import TenantDashboard from "@/components/dashboard/TenantDashboard";
import { ui } from "@/lib/brandUi";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      setData(await res.json());
    } catch (err) {
      toast.error(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className={`${ui.page} ${ui.container} max-w-[1400px]`}>
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-64 rounded-lg bg-brand-secondary/20" />
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-brand-secondary/15" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="h-80 rounded-xl bg-brand-secondary/15" />
            <div className="h-80 rounded-xl bg-brand-secondary/15" />
          </div>
        </div>
      </div>
    );
  }

  return <TenantDashboard data={data} />;
};

export default DashboardLayout()(Page);

"use client";

import "../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MofuTabs from "@/components/mofu/MofuTabs";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mofu/companies");
      if (!res.ok) throw new Error("Failed to load companies");
      const json = await res.json();
      setCompanies(json.companies ?? []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1100px] space-y-5`}>
      <div>
        <h1 className={ui.title}>Companies</h1>
        <p className={ui.subtitle}>Accounts across your tenant&apos;s deals (company-level intelligence).</p>
      </div>
      <MofuTabs />
      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className={ui.divider}>
          {loading ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">Loading…</p>
          ) : !companies.length ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">
              No companies yet. Associate companies to deals in HubSpot, then run Suggest now / Sync.
            </p>
          ) : (
            companies.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/mofu/companies/${c.id}`} className="text-sm font-medium text-brand-ink truncate hover:underline block">
                      {c.name || "Company"}
                    </Link>
                    <p className="text-xs text-brand-stone mt-0.5">
                      {c.domain || "—"}{c.industry ? ` · ${c.industry}` : ""} · {c.dealCount} deal(s)
                      {c.hasInsight ? " · has insight" : ""}
                    </p>
                  </div>
                  <div className="text-xs text-brand-steel shrink-0 text-right">
                    {(c.deals || []).slice(0, 2).map((d) => (
                      <Link key={d.hubspotDealId} href={`/mofu/deals/${d.hubspotDealId}`} className="block hover:underline">
                        {d.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(Page);

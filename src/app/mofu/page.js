"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HiOutlineArrowRight } from "react-icons/hi2";
import { toast } from "sonner";

function money(amount, currency) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount}`;
  }
}

const Page = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/mofu/operator");
      if (!res.ok) throw new Error("Failed to load MOFU dashboard");
      setData(await res.json());
    } catch (err) {
      toast.error(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncDeals = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/mofu/deals/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.reason || "Sync failed");
      toast.success(`Synced ${json.hydrated}/${json.total} deals from HubSpot`);
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className={`${ui.page} ${ui.container} max-w-[1200px]`}>
        <p className={ui.body}>Loading MOFU…</p>
      </div>
    );
  }

  const stats = data?.stats ?? { deals: 0, signals: 0, bundles: 0, suggested: 0, sent: 0, failed: 0 };
  const deals = data?.deals ?? [];

  return (
    <div className={`${ui.page} ${ui.container} max-w-[1200px] space-y-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={ui.title}>MOFU — Deal Intelligence</h1>
          <p className={ui.subtitle}>
            Next-best-actions for Account Executives across your HubSpot deals.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={syncDeals}
            disabled={syncing}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm bg-brand-ink text-white hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync from HubSpot"}
          </button>
          <Link href="/dashboard" className={`inline-flex items-center gap-1 ${ui.link}`}>
            TOFU dashboard
            <HiOutlineArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Deals", value: stats.deals },
          { label: "Signals", value: stats.signals },
          { label: "Insight bundles", value: stats.bundles },
          { label: "NBA suggested", value: stats.suggested, highlight: stats.suggested > 0 },
          { label: "Executed", value: stats.sent },
          { label: "Failed", value: stats.failed },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`${ui.statCard} ${highlight ? "border-brand-sage/50 bg-brand-sage/25" : ""}`}>
            <p className={ui.label}>{label}</p>
            <p className={ui.statValue}>{value}</p>
          </div>
        ))}
      </div>

      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
          <h2 className={`${ui.titleSm} text-base`}>Deals</h2>
          <p className="text-xs text-brand-stone mt-0.5">HubSpot deals tracked by Clarwiz</p>
        </div>
        <div className={`${ui.divider} max-h-[560px] overflow-y-auto`}>
          {!deals.length ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">
              No deals yet. Connect HubSpot and hydrate a deal, or promote a prospect.
            </p>
          ) : (
            deals.map((d) => (
              <Link
                key={d.id}
                href={`/mofu/deals/${d.hubspotDealId}`}
                className="block px-4 py-3 hover:bg-brand-sage/15 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-ink truncate">{d.name || `Deal ${d.hubspotDealId}`}</p>
                    <p className="text-xs text-brand-stone mt-0.5">
                      {d.stage || "—"} · {d.source} · {d.signalCount} signals · {d.recommendationCount} NBA
                    </p>
                  </div>
                  <span className="text-sm text-brand-ink shrink-0">{money(d.amount, d.currency)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(Page);

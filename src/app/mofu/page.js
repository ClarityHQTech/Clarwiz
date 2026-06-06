"use client";

import "./mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MofuTabs from "@/components/mofu/MofuTabs";
import { ui } from "@/lib/brandUi";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

function money(amount, currency) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount}`;
  }
}
function rel(iso) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
const FEED_CLASS = { signal: "fi-sig", nba: "fi-nba", exec: "fi-exec", fail: "fi-fail" };
const FEED_GLYPH = { signal: "∿", nba: "⚡", exec: "✓", fail: "!" };

const Page = () => {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/mofu/operator");
      if (!res.ok) throw new Error("Failed to load MOFU dashboard");
      setData(await res.json());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sync = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/mofu/deals/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.reason || "Sync failed");
      toast.success(`Synced ${json.hydrated}/${json.total} deals`);
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const recomputeAll = async () => {
    const deals = data?.deals ?? [];
    if (!deals.length) return toast.error("No deals to recompute");
    setBusy(true);
    toast.info(`Recomputing NBAs for ${deals.length} deal(s)…`);
    try {
      for (const d of deals) {
        await fetch(`/api/mofu/deals/${d.hubspotDealId}/recompute`, { method: "POST" });
      }
      toast.success("Recompute complete");
      await fetchData();
    } catch {
      toast.error("Recompute failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={`${ui.page} ${ui.container} max-w-[1320px]`}>
        <p className={ui.body}>Loading MOFU…</p>
      </div>
    );
  }

  const s = data?.stats ?? {};
  const deals = data?.deals ?? [];
  const feed = data?.feed ?? [];

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1320px]`}>
      <div className="page-head">
        <div>
          <div className="pt">Operator Dashboard</div>
          <div className="ps">What the MOFU engine is doing across all deals — and what you can trigger.</div>
        </div>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={sync} disabled={busy}>{busy ? "Working…" : "Sync from HubSpot"}</button>
        <button className="btn btn-pri" onClick={recomputeAll} disabled={busy} style={{ marginLeft: 10 }}>Recompute all</button>
      </div>

      <MofuTabs />
      <div style={{ height: 16 }} />

      <div className="kpis">
        <div className="kpi"><div className="v">{s.deals ?? 0}</div><div className="l">Deals</div></div>
        <div className="kpi"><div className="v">{s.suggested ?? 0}</div><div className="l">NBAs awaiting approval</div></div>
        <div className="kpi"><div className="v">{s.signals ?? 0}</div><div className="l">Signals</div></div>
        <div className="kpi"><div className="v">{s.bundles ?? 0}</div><div className="l">Insight bundles</div></div>
        <div className="kpi"><div className="v">{s.sent ?? 0}</div><div className="l">Actions executed</div></div>
        <div className={`kpi ${s.failed ? "alert" : ""}`}><div className="v">{s.failed ?? 0}</div><div className="l">Failed executions</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 380px" }}>
        <div className="card">
          <div className="card-h"><span className="t">Deals needing attention</span><span className="s">ranked by NBA score</span><div className="spacer" /><span className="badge violet">dual-model jury</span></div>
          <table>
            <thead><tr><th>Deal</th><th>Stage</th><th>Top next best action</th><th>Signal</th><th /></tr></thead>
            <tbody>
              {!deals.length ? (
                <tr><td colSpan={5}><p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>No deals yet — Sync from HubSpot.</p></td></tr>
              ) : (
                deals.map((d) => (
                  <tr key={d.id}>
                    <td><div className="deal-cell"><b>{d.name || `Deal ${d.hubspotDealId}`}</b><span>{money(d.amount, d.currency)}</span></div></td>
                    <td><span className="badge gray">{d.stage || "—"}</span></td>
                    <td>{d.topNba ? (<><b style={{ fontWeight: 650 }}>{d.topNba.title}</b><div className="muted">{d.topNba.actionType?.toLowerCase()} · score {Number(d.topNba.score).toFixed(2)}</div></>) : <span className="muted">no NBA yet</span>}</td>
                    <td>{d.lastSignal ? <span className="badge blue">{d.lastSignal.kind?.toLowerCase().replace("_", " ")} · {rel(d.lastSignal.at)}</span> : <span className="muted">—</span>}</td>
                    <td><button className="btn btn-soft btn-sm" onClick={() => router.push(`/mofu/deals/${d.hubspotDealId}`)}>Open</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h"><span className="t">Live activity</span><span className="s">the core loop, running</span></div>
            <div className="card-b" style={{ padding: "6px 14px" }}>
              <div className="feed">
                {!feed.length ? (
                  <p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>No activity yet.</p>
                ) : (
                  feed.map((f, i) => (
                    <div className="feed-i" key={i}>
                      <div className={`feed-ic ${FEED_CLASS[f.type] || "fi-sig"}`}>{FEED_GLYPH[f.type] || "•"}</div>
                      <div>
                        <div className="ft"><b>{f.type === "signal" ? (f.kind || "Signal").replace("_", " ") : f.type === "exec" ? "Executed" : f.type === "fail" ? "Failed" : "NBA"}</b> · {f.deal}</div>
                        <div className="fm">{f.text}</div>
                      </div>
                      <div className="fr"><span className="time">{rel(f.at)}</span></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><span className="t">Trigger</span><span className="s">operator controls</span></div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <button className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }} onClick={recomputeAll} disabled={busy}>⚡ Suggest now (all deals)</button>
              <button className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }} onClick={sync} disabled={busy}>↻ Re-aggregate from HubSpot</button>
              <div className="cap-note" style={{ marginTop: 4 }}><span className="tag">approve gate</span> Outbound still routes to the AE — operators trigger, they don&apos;t bypass.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout()(Page);

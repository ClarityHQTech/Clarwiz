"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import { CkCard } from "@/components/assist/cockpit/primitives";
import { fmtAmountShort, fmtStaleness } from "@/components/assist/cockpit/format";
import SyncButton from "@/components/assist/cockpit/SyncButton";
import LeadCard from "./LeadCard";
import DealCard from "./DealCard";
import ActivityFeed from "./ActivityFeed";
import CompaniesRail from "./CompaniesRail";
import { buildDashboardView } from "./dashboardView";

function sumAmounts(deals) {
  return deals.reduce((acc, d) => {
    const n = typeof d.amount === "string" ? Number(d.amount) : d.amount;
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function avgScore(deals) {
  const scored = deals.filter((d) => typeof d.score === "number");
  if (!scored.length) return null;
  return Math.round(scored.reduce((a, d) => a + d.score, 0) / scored.length);
}

function EmptyGraph() {
  return (
    <div className="ck-card" style={{ padding: 40, textAlign: "center" }}>
      <div className="ck-page-title" style={{ fontSize: 28, marginBottom: 12 }}>
        Your CRM graph is <em>empty</em>
      </div>
      <p className="ck-page-subtitle" style={{ margin: "0 auto 20px" }}>
        Run your first sync to pull deals, leads and companies from HubSpot into your AE workspace.
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <SyncButton>Run first sync</SyncButton>
      </div>
    </div>
  );
}

/**
 * Cockpit AE dashboard. Receives the serializable view-model from the server
 * page and renders the stat strip + three lists (leads · deals · companies) +
 * activity feed. Wrapped in DashboardLayout (app chrome/auth gating).
 */
function OwnerToggle({ active }) {
  // Flips ?owner=mine|all; the server re-resolves the AE's owner id and re-scopes.
  return (
    <div className="ck-seg" role="group" aria-label="Book filter">
      <Link
        href="/assist?owner=mine"
        className={`ck-seg-btn${active === "mine" ? " is-active" : ""}`}
        aria-pressed={active === "mine"}
      >
        My book
      </Link>
      <Link
        href="/assist?owner=all"
        className={`ck-seg-btn${active === "all" ? " is-active" : ""}`}
        aria-pressed={active === "all"}
      >
        All
      </Link>
    </div>
  );
}

function DashboardClient({ data, actions = [], view: ownerView = "all", ownerNote = null }) {
  const router = useRouter();
  const view = buildDashboardView(data);
  const [syncing, setSyncing] = useState(false);

  const onSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/assist/sync", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Sync failed");
        return;
      }
      const c = d.counts || {};
      const parts = Object.entries(c).filter(([, v]) => typeof v === "number").map(([k, v]) => `${v} ${k}`);
      toast.success(parts.length ? `Synced ${parts.join(" · ")}` : "Sync complete");
      router.refresh();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const pipelineValue = sumAmounts(view.deals);
  const avg = avgScore(view.deals);

  return (
    <AssistShell active="dashboard" crumbs={["Today"]} onSync={onSync} syncing={syncing}>
      <div className="ck-page-header">
        <div className="ck-page-title-block">
          <div className="ck-eyebrow">Your day · AE Cockpit</div>
          <h1 className="ck-page-title">
            Good <em>day.</em>
          </h1>
          <p className="ck-page-subtitle">
            {ownerView === "mine" ? "Your" : "All"} open leads, working deals and companies from your hydrated CRM graph
            {view.latestSyncedAt ? ` · synced ${fmtStaleness(view.latestSyncedAt)}` : ""}.
          </p>
          {ownerNote ? <p className="ck-page-note">{ownerNote}</p> : null}
        </div>
        <div className="ck-page-actions">
          <OwnerToggle active={ownerView} />
          <SyncButton />
        </div>
      </div>

      {view.isEmpty ? (
        <EmptyGraph />
      ) : (
        <>
          <div className="ck-stat-strip">
            <div className="ck-stat">
              <div className="ck-stat-label">Pipeline value</div>
              <div className="ck-stat-value">{fmtAmountShort(pipelineValue)}</div>
              <div className="ck-stat-delta flat">Open deals only</div>
            </div>
            <div className="ck-stat">
              <div className="ck-stat-label">Open deals</div>
              <div className="ck-stat-value">{view.counts.deals}</div>
              <div className="ck-stat-delta flat">In flight</div>
            </div>
            <div className="ck-stat">
              <div className="ck-stat-label">Leads awaiting touch</div>
              <div className="ck-stat-value">{view.counts.leads}</div>
              <div className="ck-stat-delta flat">MQLs, no open deal</div>
            </div>
            <div className="ck-stat">
              <div className="ck-stat-label">Avg deal score</div>
              <div className="ck-stat-value">{avg == null ? "—" : avg}</div>
              <div className="ck-stat-delta flat">{view.counts.accounts} companies</div>
            </div>
          </div>

          <div className="ck-col-3">
            <CkCard title="Open Leads" count={view.counts.leads}>
              {view.leads.length === 0 ? (
                <div className="ck-empty">No marketing-qualified leads waiting.</div>
              ) : (
                <ul className="ck-list">
                  {view.leads.map((l) => (
                    <LeadCard key={l.id} lead={l} />
                  ))}
                </ul>
              )}
            </CkCard>

            <CkCard title="Working Deals" count={view.counts.deals}>
              {view.deals.length === 0 ? (
                <div className="ck-empty">No open deals right now.</div>
              ) : (
                <ul className="ck-list">
                  {view.deals.map((d) => (
                    <DealCard key={d.id} deal={d} />
                  ))}
                </ul>
              )}
            </CkCard>

            <CompaniesRail accounts={view.accounts} />
          </div>

          <div className="ck-mt-16">
            <ActivityFeed actions={actions} />
          </div>

          <div className="ck-helper-strip">
            <span>Click any deal, lead, or company to open its workroom</span>
          </div>
        </>
      )}
    </AssistShell>
  );
}

export default DashboardLayout()(DashboardClient);

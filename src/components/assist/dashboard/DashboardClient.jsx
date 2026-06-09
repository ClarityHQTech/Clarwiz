"use client";

import Link from "next/link";
import { useDisclosure } from "@chakra-ui/react";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineCog6Tooth,
} from "react-icons/hi2";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistActivityLogDrawer from "@/components/assist/AssistActivityLogDrawer";
import AssistChatLayer from "@/components/assist/AssistChatLayer";
import SyncButton from "@/components/assist/cockpit/SyncButton";
import LeadCard from "./LeadCard";
import DealCard from "./DealCard";
import ActivityFeed from "./ActivityFeed";
import CompaniesRail from "./CompaniesRail";
import { buildDashboardView } from "./dashboardView";
import { fmtAmountShort, fmtStaleness } from "@/components/assist/cockpit/format";
import { ui } from "@/lib/brandUi";

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

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div className={`${ui.statCard} ${highlight ? "border-brand-sage/50 bg-brand-sage/25" : ""}`}>
      <p className={ui.label}>{label}</p>
      <p className={ui.statValue}>{value}</p>
      {sub ? (
        <p className={`text-xs mt-0.5 ${highlight ? "text-brand-stone" : "text-brand-steel"}`}>{sub}</p>
      ) : null}
    </div>
  );
}

function ListPanel({ title, count, emptyMessage, isEmpty, children }) {
  return (
    <div className={ui.cardSurface}>
      <div className={`px-4 py-3 ${ui.tableToolbar}`}>
        <h2 className={`${ui.titleSm} text-base`}>
          {title}
          <span className="ml-2 text-sm font-sans font-normal text-brand-stone">({count})</span>
        </h2>
      </div>
      {isEmpty ? (
        <p className="px-4 py-8 text-center text-sm text-brand-stone">{emptyMessage}</p>
      ) : (
        <ul className={ui.divider}>{children}</ul>
      )}
    </div>
  );
}

function OwnerToggle({ active }) {
  return (
    <div className="inline-flex rounded-lg border border-brand-secondary/40 bg-brand-surface p-0.5" role="group" aria-label="Book filter">
      <Link
        href="/assist?owner=mine"
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active === "mine"
            ? "bg-brand-dark text-white"
            : "text-brand-stone hover:text-brand-ink"
        }`}
        aria-pressed={active === "mine"}
      >
        My book
      </Link>
      <Link
        href="/assist?owner=all"
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active === "all"
            ? "bg-brand-dark text-white"
            : "text-brand-stone hover:text-brand-ink"
        }`}
        aria-pressed={active === "all"}
      >
        All
      </Link>
    </div>
  );
}

function EmptyGraph() {
  return (
    <div className={`${ui.cardSurface} p-10 text-center`}>
      <h2 className={`${ui.titleSm} mb-2`}>Your CRM graph is empty</h2>
      <p className={`${ui.body} max-w-md mx-auto mb-5`}>
        Run your first sync to pull deals, leads and companies from HubSpot into your AE workspace.
      </p>
      <SyncButton>Run first sync</SyncButton>
    </div>
  );
}

function DashboardClient({ data, actions = [], view: ownerView = "all", ownerNote = null }) {
  const view = buildDashboardView(data);
  const {
    isOpen: activityDrawerOpen,
    onOpen: openActivityDrawer,
    onClose: closeActivityDrawer,
  } = useDisclosure();

  const pipelineValue = sumAmounts(view.deals);
  const avg = avgScore(view.deals);

  return (
    <div className={`${ui.page} ${ui.container} space-y-6`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className={ui.title}>AE Assist</h1>
          <p className={ui.subtitle}>
            {ownerView === "mine" ? "Your" : "All"} open leads, working deals and companies from your hydrated CRM graph
            {view.latestSyncedAt ? ` · synced ${fmtStaleness(view.latestSyncedAt)}` : ""}.
          </p>
          {ownerNote ? <p className="text-xs text-brand-terracotta mt-2">{ownerNote}</p> : null}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <OwnerToggle active={ownerView} />
          <Link href="/assist/settings" className={ui.btnSecondarySurface}>
            <HiOutlineCog6Tooth className="h-4 w-4" />
            Settings
          </Link>
          <button type="button" onClick={openActivityDrawer} className={ui.btnSecondarySurface}>
            <HiOutlineClipboardDocumentList className="h-4 w-4" />
            Activity log
          </button>
          <SyncButton />
        </div>
      </div>

      {view.isEmpty ? (
        <EmptyGraph />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Pipeline value" value={fmtAmountShort(pipelineValue)} sub="Open deals only" />
            <MetricCard label="Open deals" value={view.counts.deals} sub="In flight" />
            <MetricCard label="Leads awaiting touch" value={view.counts.leads} sub="MQLs, no open deal" />
            <MetricCard
              label="Avg deal score"
              value={avg == null ? "—" : avg}
              sub={`${view.counts.accounts} companies`}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <ListPanel
              title="Open leads"
              count={view.counts.leads}
              isEmpty={view.leads.length === 0}
              emptyMessage="No marketing-qualified leads waiting."
            >
              {view.leads.map((l) => (
                <LeadCard key={l.id} lead={l} />
              ))}
            </ListPanel>

            <ListPanel
              title="Working deals"
              count={view.counts.deals}
              isEmpty={view.deals.length === 0}
              emptyMessage="No open deals right now."
            >
              {view.deals.map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </ListPanel>

            <CompaniesRail accounts={view.accounts} />
          </div>

          <ActivityFeed actions={actions.slice(0, 12)} />

          <p className="text-xs text-brand-stone text-center">
            Click any deal, lead, or company to open its workroom
          </p>
        </>
      )}

      <AssistActivityLogDrawer
        isOpen={activityDrawerOpen}
        onClose={closeActivityDrawer}
        actions={actions}
      />

      <AssistChatLayer pageContext={{ entityType: "pipeline", label: "Pipeline" }} />
    </div>
  );
}

export default DashboardLayout()(DashboardClient);

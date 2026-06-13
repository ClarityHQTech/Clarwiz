"use client";

import Link from "next/link";
import { useDisclosure } from "@chakra-ui/react";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineCog6Tooth,
} from "react-icons/hi2";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistActivityLogDrawer from "@/components/assist/AssistActivityLogDrawer";
import SyncButton from "@/components/assist/dashboard/SyncButton";
import DealsTable from "./DealsTable";
import { buildDealsPageView } from "./dashboardView";
import { fmtAmountShort, fmtStaleness } from "@/components/assist/format";
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

function OwnerToggle({ active }) {
  return (
    <div className="inline-flex rounded-lg border border-brand-secondary/40 bg-brand-surface p-0.5" role="group" aria-label="Deal scope">
      <Link
        href="/assist"
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active === "all"
            ? "bg-brand-dark text-white"
            : "text-brand-stone hover:text-brand-ink"
        }`}
        aria-pressed={active === "all"}
      >
        All deals
      </Link>
      <Link
        href="/assist?owner=mine"
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active === "mine"
            ? "bg-brand-dark text-white"
            : "text-brand-stone hover:text-brand-ink"
        }`}
        aria-pressed={active === "mine"}
      >
        My deals
      </Link>
    </div>
  );
}

function EmptyGraph() {
  return (
    <div className={`${ui.cardSurface} p-10 text-center`}>
      <h2 className={`${ui.titleSm} mb-2`}>No working deals yet</h2>
      <p className={`${ui.body} max-w-md mx-auto mb-5`}>
        Run your first sync to pull open deals from HubSpot into your AE workspace.
      </p>
      <SyncButton>Run first sync</SyncButton>
    </div>
  );
}

function DashboardClient({ data, actions = [], view: ownerView = "all", ownerNote = null }) {
  const view = buildDealsPageView(data);
  const {
    isOpen: activityDrawerOpen,
    onOpen: openActivityDrawer,
    onClose: closeActivityDrawer,
  } = useDisclosure();

  const pipelineValue = sumAmounts(view.deals);
  const avg = avgScore(view.deals);
  const totalContacts = view.deals.reduce((n, d) => n + d.contactCount, 0);
  const totalExecutedNbas = view.deals.reduce((n, d) => n + d.executedNbaCount, 0);

  return (
    <div className={`${ui.page} ${ui.container} space-y-6`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className={ui.title}>AE Assist</h1>
          <p className={ui.subtitle}>
            {ownerView === "mine" ? "Your" : "All"} working deals from your hydrated CRM graph
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Pipeline value" value={fmtAmountShort(pipelineValue)} sub="Open deals only" />
        <MetricCard label="Working deals" value={view.count} sub="In flight" />
        <MetricCard label="Contacts linked" value={totalContacts} sub="Across open deals" />
        <MetricCard
          label="Avg deal score"
          value={avg == null ? "—" : avg}
          sub={`${totalExecutedNbas} NBA${totalExecutedNbas === 1 ? "" : "s"} executed`}
        />
      </div>

      {view.isEmpty ? (
        <EmptyGraph />
      ) : (
        <>
          <div className={`flex items-center justify-between gap-3 ${ui.tableToolbar} rounded-xl border border-brand-secondary/30 bg-brand-surface px-4 py-3`}>
            <h2 className={`${ui.titleSm} text-base`}>
              Working deals
              <span className="ml-2 text-sm font-sans font-normal text-brand-stone">({view.count})</span>
            </h2>
          </div>
          <DealsTable deals={view.deals} />
          <p className="text-xs text-brand-stone text-center">
            Click any deal to open its workroom
          </p>
        </>
      )}

      <AssistActivityLogDrawer
        isOpen={activityDrawerOpen}
        onClose={closeActivityDrawer}
        actions={actions}
      />
    </div>
  );
}

export default DashboardLayout()(DashboardClient);

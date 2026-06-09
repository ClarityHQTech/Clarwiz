"use client";

import AssistBadge from "../ui/AssistBadge";
import { fmtAmount, fmtDate, fmtStaleness } from "../cockpit/format";
import { ui } from "@/lib/brandUi";

function ScoreBlock({ label, value }) {
  return (
    <div className={`${ui.miniStat} text-center min-w-[88px]`}>
      <p className="text-xs text-brand-stone">{label}</p>
      <p className="text-2xl font-semibold text-brand-ink tabular-nums mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

export default function DealHeader({ deal, accountName, accountScore, stakeholders = 0, lastActivityLabel }) {
  const score = typeof deal?.score === "number" ? deal.score : null;

  return (
    <div className={`${ui.cardSurface} p-4 sm:p-5 space-y-4`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          {accountName ? <p className={`${ui.label} mb-1 normal-case tracking-wide`}>{accountName}</p> : null}
          <h1 className={`${ui.titleSm} text-2xl`}>{deal?.name ?? "Untitled deal"}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {deal?.stageLabel ? <AssistBadge variant="accent">{deal.stageLabel}</AssistBadge> : null}
            {deal?.status ? (
              <AssistBadge variant={deal.status === "OPEN" ? "ok" : "ghost"}>{deal.status}</AssistBadge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ScoreBlock label="Deal score" value={score} />
          <ScoreBlock label="Account" value={accountScore} />
          <div className={`${ui.statCard} min-w-[120px]`}>
            <p className={ui.label}>Contract value</p>
            <p className={ui.statValue}>{fmtAmount(deal?.amount)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={ui.miniStat}>
          <p className="text-xs text-brand-stone">Last activity</p>
          <p className="text-sm font-semibold text-brand-ink mt-0.5">
            {lastActivityLabel || fmtStaleness(deal?.lastActivityAt)}
          </p>
        </div>
        <div className={ui.miniStat}>
          <p className="text-xs text-brand-stone">Stakeholders</p>
          <p className="text-sm font-semibold text-brand-ink mt-0.5">
            {stakeholders} {stakeholders === 1 ? "contact" : "contacts"}
          </p>
        </div>
        <div className={ui.miniStat}>
          <p className="text-xs text-brand-stone">Status</p>
          <p className="text-sm font-semibold text-brand-ink mt-0.5">{deal?.status ?? "—"}</p>
        </div>
        <div className={ui.miniStat}>
          <p className="text-xs text-brand-stone">Last touch date</p>
          <p className="text-sm font-semibold text-brand-ink mt-0.5">{fmtDate(deal?.lastActivityAt)}</p>
        </div>
      </div>
    </div>
  );
}

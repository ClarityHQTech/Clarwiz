"use client";

import { useState } from "react";
import CompanyDrawer from "../CompanyDrawer";
import AssistBadge from "../ui/AssistBadge";
import { asScore } from "../format";
import { ui } from "@/lib/brandUi";

export default function CompaniesRail({ accounts = [] }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const onOpen = (account) => {
    setSelected(account);
    setOpen(true);
  };

  return (
    <>
      <div className={ui.cardSurface}>
        <div className={`flex items-center justify-between px-4 py-3 ${ui.tableToolbar}`}>
          <h2 className={`${ui.titleSm} text-base`}>
            Companies
            <span className="ml-2 text-sm font-sans font-normal text-brand-stone">({accounts.length})</span>
          </h2>
        </div>
        {accounts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-brand-stone">
            No companies yet. Sync from HubSpot to hydrate your accounts.
          </p>
        ) : (
          <ul className={ui.divider}>
            {accounts.map((a) => {
              const company = a.company ?? {};
              const dealCount = a._count?.deals ?? 0;
              const score = asScore(a.payload?.account_score ?? a.score);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-brand-sage/10 transition-colors"
                    onClick={() => onOpen(a)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-ink truncate">
                        {company.name || "Unknown company"}
                      </p>
                      <p className="text-xs text-brand-stone mt-0.5 truncate">
                        {[company.industry, company.domain].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <div className="mt-2">
                        <AssistBadge variant={dealCount > 0 ? "accent" : "ghost"}>
                          {dealCount} {dealCount === 1 ? "deal" : "deals"}
                        </AssistBadge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {score != null ? (
                        <>
                          <p className="text-sm font-semibold text-brand-ink tabular-nums">{score}</p>
                          <p className="text-xs text-brand-stone mt-0.5">Health</p>
                        </>
                      ) : (
                        <p className="text-xs text-brand-stone">View</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CompanyDrawer accountId={selected?.id ?? null} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

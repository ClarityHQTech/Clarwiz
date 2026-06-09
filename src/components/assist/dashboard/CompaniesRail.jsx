"use client";

import { useState } from "react";
import CompanyDrawer from "../CompanyDrawer";
import { CkCard, CkBadge } from "../cockpit/primitives";
import { asScore } from "../cockpit/format";

/**
 * Companies rail (cockpit): account rows that open the 10-tab CompanyDrawer.
 * Owns the selected-account + drawer-open state (client side).
 * account = Account { id, company{name,domain,industry}, _count{deals}, payload? }
 */
export default function CompaniesRail({ accounts = [] }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const onOpen = (account) => {
    setSelected(account);
    setOpen(true);
  };

  return (
    <>
      <CkCard title="Companies" count={accounts.length}>
        {accounts.length === 0 ? (
          <div className="ck-empty">No companies yet. Sync from HubSpot to hydrate your accounts.</div>
        ) : (
          <ul className="ck-list">
            {accounts.map((a) => {
              const company = a.company ?? {};
              const dealCount = a._count?.deals ?? 0;
              const score = asScore(a.payload?.account_score ?? a.score);
              return (
                <li key={a.id}>
                  <button type="button" className="ck-list-item" onClick={() => onOpen(a)}>
                    <div>
                      <div className="ck-list-item-name">{company.name || "Unknown company"}</div>
                      <div className="ck-list-item-meta">
                        {company.industry && <span>{company.industry}</span>}
                        {company.industry && company.domain && <span className="dot">·</span>}
                        {company.domain && <span>{company.domain}</span>}
                      </div>
                      <div className="ck-chip-row">
                        <CkBadge variant={dealCount > 0 ? "accent" : "ghost"}>
                          {dealCount} {dealCount === 1 ? "deal" : "deals"}
                        </CkBadge>
                      </div>
                    </div>
                    <div className="ck-list-item-side">
                      {score != null ? (
                        <>
                          <div className="amount">{score}</div>
                          <div className="activity">Health</div>
                        </>
                      ) : (
                        <div className="activity">View</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CkCard>

      <CompanyDrawer accountId={selected?.id ?? null} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

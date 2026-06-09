"use client";

import { ScoreRing, CkBadge } from "../cockpit/primitives";
import { fmtAmount, fmtDate, fmtStaleness } from "../cockpit/format";

/**
 * Deal hero (cockpit): company eyebrow, serif deal name, stage pill, Deal +
 * Account circular score gauges, amount, and a 4-up hero stat strip.
 */
export default function DealHeader({ deal, accountName, accountScore, stakeholders = 0, lastActivityLabel }) {
  const score = typeof deal?.score === "number" ? deal.score : null;

  return (
    <div className="ck-deal-hero">
      <div className="ck-deal-hero-top">
        <div className="ck-deal-hero-meta" style={{ flex: 1, minWidth: 240 }}>
          {accountName && <div className="ck-deal-company">{accountName}</div>}
          <div className="ck-deal-name">{deal?.name ?? "Untitled deal"}</div>
          <div className="ck-deal-stage-row">
            {deal?.stageLabel && <span className="ck-stage-pill">{deal.stageLabel}</span>}
            {deal?.status && (
              <CkBadge variant={deal.status === "OPEN" ? "ok" : "ghost"}>{deal.status}</CkBadge>
            )}
          </div>
        </div>

        <div className="ck-deal-score-block">
          <ScoreRing score={score} label="Deal" />
          <ScoreRing score={accountScore} label="Account" />
          <div className="ck-deal-amount-box">
            <div className="ck-deal-amount-label">Contract value</div>
            <div className="ck-deal-amount-value">{fmtAmount(deal?.amount)}</div>
          </div>
        </div>
      </div>

      <div className="ck-deal-hero-stats">
        <div className="ck-hero-stat">
          <div className="ck-hero-stat-label">Last activity</div>
          <div className="ck-hero-stat-value">
            {lastActivityLabel || fmtStaleness(deal?.lastActivityAt)}
          </div>
        </div>
        <div className="ck-hero-stat">
          <div className="ck-hero-stat-label">Stakeholders</div>
          <div className="ck-hero-stat-value">
            {stakeholders} {stakeholders === 1 ? "contact" : "contacts"}
          </div>
        </div>
        <div className="ck-hero-stat">
          <div className="ck-hero-stat-label">Status</div>
          <div className="ck-hero-stat-value">{deal?.status ?? "—"}</div>
        </div>
        <div className="ck-hero-stat">
          <div className="ck-hero-stat-label">Last touch date</div>
          <div className="ck-hero-stat-value">{fmtDate(deal?.lastActivityAt)}</div>
        </div>
      </div>
    </div>
  );
}

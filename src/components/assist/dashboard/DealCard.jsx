"use client";

import NextLink from "next/link";
import { CkBadge } from "../cockpit/primitives";
import { fmtAmountShort, fmtStaleness } from "../cockpit/format";

function scoreVariant(score) {
  if (score == null) return "ghost";
  if (score >= 70) return "ok";
  if (score >= 40) return "warn";
  return "danger";
}

/**
 * One open-deal row (cockpit) → links to /assist/deal/[id]. Stage meta +
 * amount + score chip.
 * deal = Deal { id, name, stageLabel, stageBand, amount, score, lastActivityAt, account{company{name}} }
 */
export default function DealCard({ deal }) {
  const company = deal.account?.company?.name;
  const score = typeof deal.score === "number" ? deal.score : null;

  return (
    <li>
      <NextLink href={`/assist/deal/${deal.id}`} className="ck-list-item">
        <div>
          <div className="ck-list-item-name">{deal.name || "Untitled deal"}</div>
          <div className="ck-list-item-meta">
            {company && <span>{company}</span>}
            {company && deal.stageLabel && <span className="dot">·</span>}
            {deal.stageLabel && <span>{deal.stageLabel}</span>}
          </div>
          {score != null && (
            <div className="ck-chip-row">
              <CkBadge variant={scoreVariant(score)}>Score {score}</CkBadge>
            </div>
          )}
        </div>
        <div className="ck-list-item-side">
          <div className="amount">{fmtAmountShort(deal.amount)}</div>
          <div className="activity">{fmtStaleness(deal.lastActivityAt)}</div>
        </div>
      </NextLink>
    </li>
  );
}

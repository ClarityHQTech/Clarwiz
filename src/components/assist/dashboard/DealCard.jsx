"use client";

import Link from "next/link";
import AssistBadge from "../ui/AssistBadge";
import { fmtAmountShort, fmtStaleness } from "../cockpit/format";

function scoreVariant(score) {
  if (score == null) return "ghost";
  if (score >= 70) return "ok";
  if (score >= 40) return "warn";
  return "danger";
}

export default function DealCard({ deal }) {
  const company = deal.account?.company?.name;
  const score = typeof deal.score === "number" ? deal.score : null;

  return (
    <li>
      <Link
        href={`/assist/deal/${deal.id}`}
        className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-brand-sage/10 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-ink truncate">{deal.name || "Untitled deal"}</p>
          <p className="text-xs text-brand-stone mt-0.5 truncate">
            {[company, deal.stageLabel].filter(Boolean).join(" · ") || "—"}
          </p>
          {score != null ? (
            <div className="mt-2">
              <AssistBadge variant={scoreVariant(score)}>Score {score}</AssistBadge>
            </div>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-brand-ink tabular-nums">{fmtAmountShort(deal.amount)}</p>
          <p className="text-xs text-brand-stone mt-0.5">{fmtStaleness(deal.lastActivityAt)}</p>
        </div>
      </Link>
    </li>
  );
}

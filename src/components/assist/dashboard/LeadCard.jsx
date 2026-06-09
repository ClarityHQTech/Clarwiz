"use client";

import Link from "next/link";
import AssistBadge from "../ui/AssistBadge";

export default function LeadCard({ lead }) {
  const bu = lead.businessUser ?? {};
  const name = bu.name || bu.email || "Unknown lead";
  const company = bu.company?.name;
  const stageLabel = lead.lifecycleStage === "lead" ? "Lead" : "MQL";

  return (
    <li>
      <Link
        href={`/assist/lead/${lead.id}`}
        className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-brand-sage/10 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-ink truncate">{name}</p>
          <p className="text-xs text-brand-stone mt-0.5 truncate">
            {[company, bu.jobTitle].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-2">
            <AssistBadge variant="accent">{stageLabel}</AssistBadge>
          </div>
        </div>
        {bu.email ? (
          <span className="text-xs text-brand-stone shrink-0 max-w-[140px] truncate">{bu.email}</span>
        ) : null}
      </Link>
    </li>
  );
}

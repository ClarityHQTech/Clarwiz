"use client";

import NextLink from "next/link";
import { CkBadge } from "../cockpit/primitives";

/**
 * One MQL contact row (cockpit) → links to /assist/lead/[id].
 * lead = Contact { id, lifecycleStage, businessUser{ name, jobTitle, email, company{name} } }
 */
export default function LeadCard({ lead }) {
  const bu = lead.businessUser ?? {};
  const name = bu.name || bu.email || "Unknown lead";
  const company = bu.company?.name;
  const stageLabel = lead.lifecycleStage === "lead" ? "Lead" : "MQL";

  return (
    <li>
      <NextLink href={`/assist/lead/${lead.id}`} className="ck-list-item">
        <div>
          <div className="ck-list-item-name">{name}</div>
          <div className="ck-list-item-meta">
            {company && <span>{company}</span>}
            {company && bu.jobTitle && <span className="dot">·</span>}
            {bu.jobTitle && <span>{bu.jobTitle}</span>}
          </div>
          <div className="ck-chip-row">
            <CkBadge variant="accent">{stageLabel}</CkBadge>
          </div>
        </div>
        <div className="ck-list-item-side">
          {bu.email && <div className="activity" style={{ textTransform: "none", letterSpacing: 0 }}>{bu.email}</div>}
        </div>
      </NextLink>
    </li>
  );
}

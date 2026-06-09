"use client";

import { CkBadge, initials } from "../cockpit/primitives";

const PERSONA_LABEL = {
  DECISION_MAKER: "Decision Maker",
  CHAMPION: "Champion",
  INFLUENCER: "Influencer",
  BLOCKER: "Blocker",
  END_USER: "End User",
  OTHER: "Contact",
};

/**
 * Lead identity card (cockpit): avatar, name, persona badge, title · company,
 * email/phone. Defensive — businessUser/company may be partially populated.
 */
export default function ContactCard({ contact, businessUser, company }) {
  const bu = businessUser ?? contact?.businessUser ?? {};
  const co = company ?? bu.company ?? null;
  const name = bu.name || [bu.firstName, bu.lastName].filter(Boolean).join(" ") || "Unknown contact";
  const persona = PERSONA_LABEL[contact?.persona] ?? "Contact";

  return (
    <div className="ck-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
        <div className="ck-sh-avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
          {initials(name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, color: "var(--text)", fontWeight: 600 }}>{name}</div>
            <CkBadge variant="accent">{persona}</CkBadge>
          </div>
          {(bu.jobTitle || co?.name) && (
            <div className="ck-sh-role" style={{ marginTop: 4 }}>
              {bu.jobTitle}
              {bu.jobTitle && co?.name ? " · " : ""}
              {co?.name}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {bu.email && (
          <a href={`mailto:${bu.email}`} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
            {bu.email}
          </a>
        )}
        {bu.phone && <div style={{ fontSize: 13, color: "var(--text-2)" }}>{bu.phone}</div>}
        {contact?.lifecycleStage && (
          <div className="ck-eyebrow" style={{ margin: 0 }}>{contact.lifecycleStage}</div>
        )}
      </div>
    </div>
  );
}

"use client";

import AssistBadge from "../ui/AssistBadge";
import { initials } from "../ui/AssistPrimitives";
import { ui } from "@/lib/brandUi";

const PERSONA_LABEL = {
  DECISION_MAKER: "Decision Maker",
  CHAMPION: "Champion",
  INFLUENCER: "Influencer",
  BLOCKER: "Blocker",
  END_USER: "End User",
  OTHER: "Contact",
};

export default function ContactCard({ contact, businessUser, company }) {
  const bu = businessUser ?? contact?.businessUser ?? {};
  const co = company ?? bu.company ?? null;
  const name = bu.name || [bu.firstName, bu.lastName].filter(Boolean).join(" ") || "Unknown contact";
  const persona = PERSONA_LABEL[contact?.persona] ?? "Contact";

  return (
    <div className={`${ui.cardSurface} p-4 sm:p-5`}>
      <div className="flex gap-4 items-center mb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-sage/25 text-sm font-semibold text-brand-ink">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-medium text-brand-ink">{name}</p>
            <AssistBadge variant="accent">{persona}</AssistBadge>
          </div>
          {(bu.jobTitle || co?.name) && (
            <p className="text-sm text-brand-stone mt-0.5">
              {bu.jobTitle}
              {bu.jobTitle && co?.name ? " · " : ""}
              {co?.name}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1 text-sm">
        {bu.email ? (
          <a href={`mailto:${bu.email}`} className="text-brand-terracotta hover:underline">
            {bu.email}
          </a>
        ) : null}
        {bu.phone ? <p className="text-brand-stone">{bu.phone}</p> : null}
        {contact?.lifecycleStage ? (
          <p className={`${ui.label} normal-case tracking-wide`}>{contact.lifecycleStage}</p>
        ) : null}
      </div>
    </div>
  );
}

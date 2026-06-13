"use client";

import AssistBadge from "./ui/AssistBadge";
import { initials } from "./ui/AssistPrimitives";
import { ui } from "@/lib/brandUi";

const PERSONA_LABEL = {
  DECISION_MAKER: "Decision Maker",
  CHAMPION: "Champion",
  INFLUENCER: "Influencer",
  BLOCKER: "Blocker",
  END_USER: "End User",
  OTHER: "Contact",
};

function ContactField({ label, value, href }) {
  if (!value) return null;
  return (
    <div className={ui.miniStat}>
      <p className="text-xs text-brand-stone">{label}</p>
      {href ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="text-sm font-medium text-brand-terracotta hover:text-brand-ink mt-0.5 break-all"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium text-brand-ink mt-0.5 break-all">{value}</p>
      )}
    </div>
  );
}

export default function ContactProfileSection({ contact, businessUser, company, persona }) {
  const bu = businessUser ?? contact?.businessUser ?? {};
  const name =
    bu.name ||
    [bu.firstName, bu.lastName].filter(Boolean).join(" ") ||
    bu.email ||
    "Contact";
  const personaLabel = PERSONA_LABEL[persona ?? contact?.persona] ?? null;

  return (
    <div className={`${ui.cardSurface} p-4 sm:p-5 space-y-4`}>
      <div className="flex gap-4 items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-sage/25 text-sm font-semibold text-brand-ink">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-brand-ink">{name}</p>
          {(bu.jobTitle || company?.name) && (
            <p className="text-sm text-brand-stone mt-0.5">
              {[bu.jobTitle, company?.name].filter(Boolean).join(" · ")}
            </p>
          )}
          {personaLabel ? (
            <div className="mt-2">
              <AssistBadge variant="accent">{personaLabel}</AssistBadge>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <ContactField label="Email" value={bu.email} href={bu.email ? `mailto:${bu.email}` : null} />
        <ContactField label="Phone" value={bu.phone} href={bu.phone ? `tel:${bu.phone}` : null} />
        <ContactField label="WhatsApp" value={bu.whatsapp} href={bu.whatsapp ? `tel:${bu.whatsapp}` : null} />
        <ContactField
          label="LinkedIn"
          value={bu.linkedinUrl}
          href={bu.linkedinUrl?.startsWith("http") ? bu.linkedinUrl : bu.linkedinUrl ? `https://${bu.linkedinUrl}` : null}
        />
      </div>
    </div>
  );
}

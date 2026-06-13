"use client";

import { HiOutlineBuildingOffice2, HiOutlineChevronRight, HiOutlineUserGroup } from "react-icons/hi2";
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

function AssociationCard({ icon: Icon, label, title, meta, badges = [], onClick, disabled }) {
  const content = (
    <>
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-secondary/30 bg-brand-bg text-brand-stone">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={ui.label}>{label}</p>
          <p className="text-sm font-medium text-brand-ink truncate mt-1">{title}</p>
          {meta ? <p className="text-xs text-brand-stone mt-0.5 truncate">{meta}</p> : null}
          {badges.length ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {badges.map((badge) => (
                <AssistBadge key={badge} variant="ghost">
                  {badge}
                </AssistBadge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {!disabled ? (
        <HiOutlineChevronRight className="h-4 w-4 shrink-0 text-brand-steel group-hover:text-brand-terracotta transition-colors" />
      ) : null}
    </>
  );

  if (disabled) {
    return <div className={`${ui.cardMuted} px-4 py-3 opacity-80`}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-3 ${ui.cardSurface} px-4 py-3 text-left hover:border-brand-sage/40 hover:bg-brand-sage/5 transition-colors`}
    >
      {content}
    </button>
  );
}

function ContactRow({ contact, onClick }) {
  const persona = PERSONA_LABEL[contact.persona] ?? null;
  const hasTofu = contact.campaignName || typeof contact.tofuScore === "number";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${ui.tableRowHover}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-sage/25 text-xs font-semibold text-brand-ink">
            {initials(contact.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-ink truncate">{contact.name}</p>
            <p className="text-xs text-brand-stone mt-0.5 truncate">
              {[contact.title, contact.email].filter(Boolean).join(" · ") || "—"}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {persona ? <AssistBadge variant="accent">{persona}</AssistBadge> : null}
              {hasTofu ? (
                <AssistBadge variant="info">
                  {contact.campaignName || "Campaign"}
                  {typeof contact.tofuScore === "number" ? ` · ${contact.tofuScore}` : ""}
                </AssistBadge>
              ) : null}
            </div>
          </div>
        </div>
        <HiOutlineChevronRight className="h-4 w-4 shrink-0 text-brand-steel group-hover:text-brand-terracotta transition-colors" />
      </button>
    </li>
  );
}

export default function DealAssociations({
  account,
  company,
  accountScore,
  campaignContexts = [],
  contacts = [],
  onOpenCompany,
  onOpenContact,
}) {
  const companyName = company?.name ?? account?.company?.name ?? "Unknown company";
  const companyMeta = [company?.industry ?? account?.company?.industry, company?.domain ?? account?.company?.domain]
    .filter(Boolean)
    .join(" · ");

  const companyBadges = [];
  if (accountScore != null) companyBadges.push(`Health ${accountScore}`);
  const primaryCampaign = campaignContexts[0];
  if (primaryCampaign?.campaign?.name) {
    companyBadges.push(primaryCampaign.campaign.name);
    if (typeof primaryCampaign.score === "number") companyBadges.push(`Score ${primaryCampaign.score}`);
  }

  const canOpenCompany = Boolean(account?.id);

  return (
    <div className={`${ui.cardSurface} p-4 sm:p-5 space-y-4`}>
      <div>
        <h2 className={ui.titleSm}>Associated with</h2>
        <p className={`${ui.body} mt-1`}>Open company or contact details in the side drawer.</p>
      </div>

      <AssociationCard
        icon={HiOutlineBuildingOffice2}
        label="Company"
        title={companyName}
        meta={companyMeta || "—"}
        badges={companyBadges}
        onClick={() => onOpenCompany?.(account)}
        disabled={!canOpenCompany}
      />

      <div className="rounded-xl border border-brand-secondary/30 overflow-hidden">
        <div className={`flex items-center gap-2 px-4 py-3 ${ui.tableToolbar}`}>
          <HiOutlineUserGroup className="h-4 w-4 text-brand-stone" />
          <h3 className={`${ui.titleSm} text-sm`}>
            Contacts
            <span className="ml-2 text-sm font-sans font-normal text-brand-stone">({contacts.length})</span>
          </h3>
        </div>
        {contacts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-brand-stone">No contacts linked to this deal yet.</p>
        ) : (
          <ul className={ui.divider}>
            {contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onClick={() => onOpenContact?.(contact)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

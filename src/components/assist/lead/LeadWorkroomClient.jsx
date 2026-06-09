"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistWorkroomLayout from "@/components/assist/AssistWorkroomLayout";
import AssistBadge from "../ui/AssistBadge";
import { AssistPanel } from "../ui/AssistPanel";
import ContactCard from "./ContactCard";
import CompanyInsightPanel from "./CompanyInsightPanel";
import TofuTimeline from "./TofuTimeline";
import PromoteButton from "./PromoteButton";
import { tierDot, signalLabel } from "../deal/SignalsStrip";

const DOT_CLASS = {
  t1: "bg-red-500",
  t2: "bg-brand-gold",
  t3: "bg-brand-terracotta/70",
};

function SignalsPanel({ signals = [] }) {
  if (!signals.length) return null;
  return (
    <AssistPanel title="Signals" count={signals.length}>
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {signals.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-bg border border-brand-secondary/25 px-3 py-1 text-xs font-medium text-brand-ink"
            title={s.evidence || s.suggestedAngle || ""}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${DOT_CLASS[tierDot(s)]}`} />
            {signalLabel(s)}
            {typeof s.score === "number" ? ` · ${s.score}` : ""}
          </span>
        ))}
      </div>
    </AssistPanel>
  );
}

function NbaStrip({ nbas = [] }) {
  if (!nbas.length) return null;
  return (
    <AssistPanel title="Next best actions" count={nbas.length}>
      <ul className="divide-y divide-brand-secondary/15">
        {nbas.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-ink">
                {n.title || n.actionType || "Recommended action"}
              </p>
              {n.rationale ? <p className="text-xs text-brand-stone mt-1">{n.rationale}</p> : null}
            </div>
            <div className="text-right shrink-0 space-y-1">
              {typeof n.score === "number" ? (
                <p className="text-sm font-semibold text-brand-terracotta tabular-nums">+{n.score}</p>
              ) : null}
              <AssistBadge variant="accent">Top</AssistBadge>
            </div>
          </li>
        ))}
      </ul>
    </AssistPanel>
  );
}

function LeadWorkroomClient({ view, timeline, companyName, leadName }) {
  const { contact, businessUser, account, company, insight, signals, nbas } = view;
  const chatContext = { entityType: "lead", contactId: contact?.id, label: leadName };

  return (
    <AssistWorkroomLayout
      crumbs={[companyName || "Lead", leadName]}
      eyebrow={`MQL${companyName ? ` · ${companyName}` : ""}`}
      title={leadName}
      subtitle={`${businessUser?.jobTitle ? `${businessUser.jobTitle} · ` : ""}Marketing-qualified lead — promote to a deal when a demo is booked.`}
      actions={<PromoteButton contactId={contact.id} companyName={companyName} />}
      chatContext={chatContext}
    >
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-4">
          <ContactCard contact={contact} businessUser={businessUser} company={company} />
          <CompanyInsightPanel insight={insight} company={company} account={account} />
          <SignalsPanel signals={signals} />
          <NbaStrip nbas={nbas} />
        </div>
        <TofuTimeline entries={timeline} />
      </div>
    </AssistWorkroomLayout>
  );
}

export default DashboardLayout()(LeadWorkroomClient);

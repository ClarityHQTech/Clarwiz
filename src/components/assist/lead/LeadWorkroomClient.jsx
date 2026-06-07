"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import { CkCard, CkBadge } from "@/components/assist/cockpit/primitives";
import ContactCard from "@/components/assist/lead/ContactCard";
import CompanyInsightPanel from "@/components/assist/lead/CompanyInsightPanel";
import TofuTimeline from "@/components/assist/lead/TofuTimeline";
import PromoteButton from "@/components/assist/lead/PromoteButton";
import { tierDot, signalLabel } from "@/components/assist/deal/SignalsStrip";

function SignalsPanel({ signals = [] }) {
  if (!signals.length) return null;
  return (
    <CkCard title="Signals" count={signals.length}>
      <div className="ck-signals-strip">
        {signals.map((s) => (
          <span className="ck-signal-chip" key={s.id} title={s.evidence || s.suggestedAngle || ""}>
            <span className={`dot ${tierDot(s)}`} />
            {signalLabel(s)}
            {typeof s.score === "number" ? ` · ${s.score}` : ""}
          </span>
        ))}
      </div>
    </CkCard>
  );
}

function NbaStrip({ nbas = [] }) {
  if (!nbas.length) return null;
  return (
    <CkCard title="Next Best Actions" count={nbas.length}>
      {nbas.map((n) => (
        <div className="ck-nba-item" key={n.id}>
          <div className="ck-nba-row">
            <div style={{ minWidth: 0 }}>
              <div className="ck-nba-title">{n.title || n.actionType || "Recommended action"}</div>
              {n.rationale && <div className="ck-nba-rationale">{n.rationale}</div>}
            </div>
            <div className="ck-nba-side">
              {typeof n.score === "number" && <div className="ck-nba-score">+{n.score}</div>}
              <CkBadge variant="accent">Top</CkBadge>
            </div>
          </div>
        </div>
      ))}
    </CkCard>
  );
}

function LeadWorkroomClient({ view, timeline, companyName, leadName }) {
  const { contact, businessUser, account, company, insight, signals, nbas } = view;
  const chatContext = { entityType: "lead", contactId: contact?.id, label: leadName };

  return (
    <AssistShell active="dashboard" crumbs={[companyName || "Lead", leadName]} chatContext={chatContext}>
      <div className="ck-page-header">
        <div className="ck-page-title-block">
          <div className="ck-eyebrow">MQL{companyName ? ` · ${companyName}` : ""}</div>
          <h1 className="ck-page-title">{leadName}</h1>
          <p className="ck-page-subtitle">
            {businessUser?.jobTitle ? `${businessUser.jobTitle} · ` : ""}
            Marketing-qualified lead — promote to a deal when a demo is booked.
          </p>
        </div>
        <div className="ck-page-actions">
          <PromoteButton contactId={contact.id} companyName={companyName} />
        </div>
      </div>

      <div className="ck-col-deal">
        <div className="ck-stack">
          <ContactCard contact={contact} businessUser={businessUser} company={company} />
          <CompanyInsightPanel insight={insight} company={company} account={account} />
          <SignalsPanel signals={signals} />
          <NbaStrip nbas={nbas} />
        </div>
        <div>
          <TofuTimeline entries={timeline} />
        </div>
      </div>
    </AssistShell>
  );
}

export default DashboardLayout()(LeadWorkroomClient);

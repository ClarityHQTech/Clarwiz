"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";

import DealHeader from "@/components/assist/deal/DealHeader";
import BriefingCard from "@/components/assist/deal/BriefingCard";
import GtmTaskbook from "@/components/assist/deal/GtmTaskbook";
import SignalsStrip from "@/components/assist/deal/SignalsStrip";
import RisksCard from "@/components/assist/deal/RisksCard";
import NbaRail from "@/components/assist/deal/NbaRail";
import NoteBox from "@/components/assist/deal/NoteBox";
import RecomputeButton from "@/components/assist/deal/RecomputeButton";
import EmptyInsight from "@/components/assist/deal/EmptyInsight";

function DealWorkroomClient({ id, vm }) {
  const accountName = vm.account?.company?.name ?? vm.company?.name ?? null;
  const dealName = vm.deal?.name ?? "Deal";
  const chatContext = {
    entityType: "deal",
    dealId: id,
    label: accountName ? `${accountName}` : dealName,
  };

  return (
    <AssistShell
      active="dashboard"
      crumbs={[accountName || "Deal", dealName]}
      chatContext={chatContext}
    >
      <div className="ck-page-actions" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
        <RecomputeButton dealId={id} variant="ghost" />
      </div>

      <DealHeader
        deal={vm.deal}
        accountName={accountName}
        accountScore={vm.accountScore}
        stakeholders={vm.contacts?.length ?? 0}
      />

      {!vm.hasInsight ? (
        <EmptyInsight dealId={id} />
      ) : (
        <div className="ck-stack">
          {vm.signals.length > 0 && <SignalsStrip signals={vm.signals} />}

          <div className="ck-col-deal">
            <div className="ck-stack">
              <BriefingCard vm={vm} />
              <GtmTaskbook dealId={id} gtmPaths={vm.gtmPaths} />
              <RisksCard
                earlyWarnings={vm.earlyWarnings}
                positiveOutcomes={vm.positiveOutcomes}
                coachingTip={vm.coachingTip}
              />
              <NoteBox dealId={id} />
            </div>

            <div style={{ position: "sticky", top: 72 }}>
              <NbaRail dealId={id} nbas={vm.nbas} />
            </div>
          </div>
        </div>
      )}
    </AssistShell>
  );
}

export default DashboardLayout()(DealWorkroomClient);

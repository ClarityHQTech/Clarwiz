"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistWorkroomLayout from "@/components/assist/AssistWorkroomLayout";
import DealHeader from "@/components/assist/deal/DealHeader";
import BriefingCard from "@/components/assist/deal/BriefingCard";
import GtmTaskbook from "@/components/assist/deal/GtmTaskbook";
import SignalsStrip from "@/components/assist/deal/SignalsStrip";
import RisksCard from "@/components/assist/deal/RisksCard";
import NbaRail from "@/components/assist/deal/NbaRail";
import NoteBox from "@/components/assist/deal/NoteBox";
import PostMeetingCard from "@/components/assist/deal/PostMeetingCard";
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
    <AssistWorkroomLayout
      crumbs={[accountName || "Deal", dealName]}
      actions={<RecomputeButton dealId={id} label="Recompute" />}
      chatContext={chatContext}
    >
      <DealHeader
        deal={vm.deal}
        accountName={accountName}
        accountScore={vm.accountScore}
        stakeholders={vm.contacts?.length ?? 0}
      />

      {!vm.hasInsight ? (
        <EmptyInsight dealId={id} />
      ) : (
        <div className="space-y-4">
          {vm.signals.length > 0 ? <SignalsStrip signals={vm.signals} /> : null}

          <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
            <div className="space-y-4">
              <BriefingCard vm={vm} />
              <GtmTaskbook dealId={id} gtmPaths={vm.gtmPaths} />
              <RisksCard
                earlyWarnings={vm.earlyWarnings}
                positiveOutcomes={vm.positiveOutcomes}
                coachingTip={vm.coachingTip}
              />
              <PostMeetingCard dealId={id} />
              <NoteBox dealId={id} />
            </div>

            <div className="lg:sticky lg:top-6">
              <NbaRail dealId={id} nbas={vm.nbas} contacts={vm.contacts} />
            </div>
          </div>
        </div>
      )}
    </AssistWorkroomLayout>
  );
}

export default DashboardLayout()(DealWorkroomClient);

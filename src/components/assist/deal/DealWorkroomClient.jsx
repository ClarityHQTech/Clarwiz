"use client";

import { useDisclosure } from "@chakra-ui/react";
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
import { ui } from "@/lib/brandUi";

function DealWorkroomClient({ id, vm }) {
  const { isOpen: nbaOpen, onOpen: openNba, onClose: closeNba } = useDisclosure();
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
      actions={
        <>
          {vm.hasInsight ? (
            <button type="button" className={ui.btnPrimary} onClick={openNba}>
              Next best actions
              {vm.nbas?.length ? (
                <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-semibold tabular-nums">
                  {vm.nbas.length}
                </span>
              ) : null}
            </button>
          ) : null}
          <RecomputeButton dealId={id} label="Recompute" />
        </>
      }
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
      )}

      {vm.hasInsight ? (
        <NbaRail
          dealId={id}
          nbas={vm.nbas}
          contacts={vm.contacts}
          isOpen={nbaOpen}
          onClose={closeNba}
        />
      ) : null}
    </AssistWorkroomLayout>
  );
}

export default DashboardLayout()(DealWorkroomClient);

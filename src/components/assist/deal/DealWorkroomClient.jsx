"use client";

import { useEffect, useState } from "react";
import { useDisclosure } from "@chakra-ui/react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistWorkroomLayout from "@/components/assist/AssistWorkroomLayout";
import CompanyDrawer from "@/components/assist/CompanyDrawer";
import ContactDrawer from "@/components/assist/ContactDrawer";
import DealHeader from "@/components/assist/deal/DealHeader";
import DealAssociations from "@/components/assist/deal/DealAssociations";
import DealDetailsCard from "@/components/assist/deal/DealDetailsCard";
import BriefingCard from "@/components/assist/deal/BriefingCard";
import GtmTaskbook from "@/components/assist/deal/GtmTaskbook";
import SignalsStrip from "@/components/assist/deal/SignalsStrip";
import RisksCard from "@/components/assist/deal/RisksCard";
import NbaRail from "@/components/assist/deal/NbaRail";
import PostMeetingCard from "@/components/assist/deal/PostMeetingCard";
import RecomputeButton from "@/components/assist/deal/RecomputeButton";
import EmptyInsight from "@/components/assist/deal/EmptyInsight";
import AddNoteModal from "@/components/assist/deal/AddNoteModal";
import CrmEmailModal from "@/components/assist/deal/CrmEmailModal";
import { ui } from "@/lib/brandUi";

function DealWorkroomClient({ id, vm }) {
  const { isOpen: nbaOpen, onOpen: openNba, onClose: closeNba } = useDisclosure();
  const { isOpen: noteOpen, onOpen: openNote, onClose: closeNote } = useDisclosure();
  const { isOpen: emailOpen, onOpen: openEmail, onClose: closeEmail } = useDisclosure();
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [crmEmailAvailable, setCrmEmailAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCapabilities() {
      try {
        const res = await fetch("/api/assist/crm-email/capabilities");
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setCrmEmailAvailable(!!data.capabilities?.canSend);
        }
      } catch {
        if (!cancelled) setCrmEmailAvailable(false);
      }
    }
    loadCapabilities();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountName = vm.company?.name ?? vm.account?.company?.name ?? null;
  const dealName = vm.deal?.name ?? "Deal";
  const cockpitContext = {
    entityType: "deal",
    id,
    name: accountName || dealName,
    label: accountName || dealName,
  };

  const openAccountDrawer = (account) => {
    if (!account?.id) return;
    setSelectedAccountId(account.id);
    setAccountDrawerOpen(true);
  };

  const openContactDrawer = (contact) => {
    if (!contact?.id) return;
    setSelectedContactId(contact.id);
    setContactDrawerOpen(true);
  };

  return (
    <AssistWorkroomLayout
      crumbs={[accountName || "Deal", dealName]}
      actions={
        <>
          <button type="button" className={ui.btnSecondary} onClick={openNote}>
            Add note
          </button>
          {crmEmailAvailable ? (
            <button type="button" className={ui.btnSecondary} onClick={openEmail}>
              Send email
            </button>
          ) : null}
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
      cockpitContext={cockpitContext}
    >
      <DealHeader
        deal={vm.deal}
        accountScore={vm.accountScore}
        stakeholders={vm.contacts?.length ?? 0}
      />

      <DealAssociations
        account={vm.account}
        company={vm.company}
        accountScore={vm.accountScore}
        campaignContexts={vm.campaignContexts}
        contacts={vm.contacts}
        onOpenCompany={openAccountDrawer}
        onOpenContact={openContactDrawer}
      />

      <DealDetailsCard deal={vm.deal} />

      {!vm.hasInsight ? (
        <EmptyInsight dealId={id} />
      ) : (
        <div className="space-y-4">
          {vm.signals.length > 0 ? <SignalsStrip signals={vm.signals} /> : null}
          <BriefingCard vm={vm} />
          <GtmTaskbook dealId={id} gtmPaths={vm.gtmPaths} gtmTasks={vm.gtmTasks} />
          <RisksCard
            earlyWarnings={vm.earlyWarnings}
            positiveOutcomes={vm.positiveOutcomes}
            coachingTip={vm.coachingTip}
          />
          <PostMeetingCard dealId={id} />
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

      <AddNoteModal dealId={id} isOpen={noteOpen} onClose={closeNote} />
      <CrmEmailModal
        dealId={id}
        contacts={vm.contacts}
        isOpen={emailOpen}
        onClose={closeEmail}
      />

      <CompanyDrawer
        accountId={selectedAccountId}
        isOpen={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
      />

      <ContactDrawer
        contactId={selectedContactId}
        dealId={id}
        isOpen={contactDrawerOpen}
        onClose={() => setContactDrawerOpen(false)}
      />
    </AssistWorkroomLayout>
  );
}

export default DashboardLayout()(DealWorkroomClient);

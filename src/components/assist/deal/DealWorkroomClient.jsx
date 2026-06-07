"use client";

import { Box, Grid, GridItem, Stack } from "@chakra-ui/react";
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
  const accountName = vm.account?.name ?? vm.company?.name ?? null;

  return (
    <AssistShell active="dashboard" actions={<RecomputeButton dealId={id} />}>
      <DealHeader deal={vm.deal} accountName={accountName} accountScore={vm.accountScore} />

      {!vm.hasInsight ? (
        <EmptyInsight dealId={id} />
      ) : (
        <Stack spacing={5}>
          {vm.signals.length > 0 && <SignalsStrip signals={vm.signals} />}

          <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={5}>
            <GridItem>
              <Stack spacing={5}>
                <BriefingCard vm={vm} />
                <GtmTaskbook dealId={id} gtmPaths={vm.gtmPaths} />
                <RisksCard
                  earlyWarnings={vm.earlyWarnings}
                  positiveOutcomes={vm.positiveOutcomes}
                  coachingTip={vm.coachingTip}
                />
                <NoteBox dealId={id} />
              </Stack>
            </GridItem>
            <GridItem>
              <Box position={{ lg: "sticky" }} top={{ lg: "88px" }}>
                <NbaRail dealId={id} nbas={vm.nbas} />
              </Box>
            </GridItem>
          </Grid>
        </Stack>
      )}
    </AssistShell>
  );
}

export default DashboardLayout()(DealWorkroomClient);

"use client";

import { Box, Grid, GridItem, HStack, Spacer, Text } from "@chakra-ui/react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import ContactCard from "@/components/assist/lead/ContactCard";
import CompanyInsightPanel from "@/components/assist/lead/CompanyInsightPanel";
import TofuTimeline from "@/components/assist/lead/TofuTimeline";
import PromoteButton from "@/components/assist/lead/PromoteButton";

function SignalsPanel({ signals = [] }) {
  if (!signals.length) return null;
  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={5}>
      <Text fontWeight="semibold" fontSize="sm" mb={3} letterSpacing="tight">
        Signals
      </Text>
      <Box display="flex" flexDirection="column" gap={2}>
        {signals.map((s) => (
          <HStack key={s.id} fontSize="sm">
            <Text color="gray.700" noOfLines={1}>
              {s.headline || s.type || "Signal"}
            </Text>
            <Spacer />
            {typeof s.score === "number" && (
              <Text color="orange.600" fontWeight="medium">
                {s.score}
              </Text>
            )}
          </HStack>
        ))}
      </Box>
    </Box>
  );
}

function NbaStrip({ nbas = [] }) {
  if (!nbas.length) return null;
  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={5}>
      <Text fontWeight="semibold" fontSize="sm" mb={3} letterSpacing="tight">
        Next Best Actions
      </Text>
      <Box display="flex" flexDirection="column" gap={2}>
        {nbas.map((n) => (
          <Box key={n.id} bg="orange.50" rounded="md" p={3}>
            <Text fontSize="sm" color="gray.800">
              {n.title || n.actionType || "Recommended action"}
            </Text>
            {n.rationale && (
              <Text fontSize="xs" color="gray.500" mt={1} noOfLines={2}>
                {n.rationale}
              </Text>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function LeadWorkroomClient({ view, timeline, companyName, leadName }) {
  const { contact, businessUser, account, company, insight, signals, nbas } = view;
  return (
    <AssistShell
      active="dashboard"
      title={leadName}
      subtitle={companyName ? `${companyName} · MQL` : "MQL"}
      actions={<PromoteButton contactId={contact.id} companyName={companyName} />}
    >
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={5} alignItems="start">
        <GridItem>
          <Box display="flex" flexDirection="column" gap={5}>
            <ContactCard contact={contact} businessUser={businessUser} company={company} />
            <CompanyInsightPanel insight={insight} company={company} account={account} />
            <SignalsPanel signals={signals} />
            <NbaStrip nbas={nbas} />
          </Box>
        </GridItem>
        <GridItem>
          <TofuTimeline entries={timeline} />
        </GridItem>
      </Grid>
    </AssistShell>
  );
}

export default DashboardLayout()(LeadWorkroomClient);

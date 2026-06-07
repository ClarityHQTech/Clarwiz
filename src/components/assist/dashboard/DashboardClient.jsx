"use client";

import {
  Badge,
  Box,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FiClock, FiDatabase } from "react-icons/fi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import SyncButton from "./SyncButton";
import LeadCard from "./LeadCard";
import DealCard from "./DealCard";
import ActivityFeed from "./ActivityFeed";
import CompaniesRail from "./CompaniesRail";
import { buildDashboardView, formatStaleness } from "./dashboardView";

function SectionHeader({ title, count }) {
  return (
    <HStack mb={3} spacing={2}>
      <Heading size="md" letterSpacing="tight">
        {title}
      </Heading>
      {typeof count === "number" && (
        <Badge colorScheme="gray" rounded="full" px={2}>
          {count}
        </Badge>
      )}
    </HStack>
  );
}

function EmptySection({ children }) {
  return (
    <Box borderWidth="1px" borderStyle="dashed" borderColor="gray.200" rounded="lg" p={6} bg="white">
      <Text fontSize="sm" color="gray.400">
        {children}
      </Text>
    </Box>
  );
}

function StalenessChip({ syncedAt }) {
  return (
    <HStack
      spacing={1.5}
      px={3}
      py={1.5}
      rounded="full"
      bg="gray.100"
      color="gray.600"
      fontSize="sm"
    >
      <Icon as={FiClock} />
      <Text>Synced {formatStaleness(syncedAt)}</Text>
    </HStack>
  );
}

function EmptyGraph() {
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      rounded="xl"
      bg="white"
      p={10}
      textAlign="center"
    >
      <Icon as={FiDatabase} boxSize={10} color="orange.400" mb={4} />
      <Heading size="md" mb={2}>
        Your CRM graph is empty
      </Heading>
      <Text color="gray.500" mb={6} maxW="md" mx="auto">
        Run your first sync to pull deals, leads and companies from HubSpot into your
        AE workspace.
      </Text>
      <Box>
        <SyncButton size="md">Run first sync</SyncButton>
      </Box>
    </Box>
  );
}

/**
 * Interactive AE dashboard shell. Receives the serializable view-model from the
 * server page and renders the three sections + activity rail. Wrapped in
 * DashboardLayout (app chrome) + AssistShell (assist nav).
 */
function DashboardClient({ data, actions = [] }) {
  const view = buildDashboardView(data);

  return (
    <AssistShell
      active="dashboard"
      title="Your day"
      subtitle="Open leads, working deals and companies from your hydrated CRM."
      actions={
        <HStack spacing={3}>
          <StalenessChip syncedAt={view.latestSyncedAt} />
          <SyncButton />
        </HStack>
      }
    >
      {view.isEmpty ? (
        <EmptyGraph />
      ) : (
        <Grid templateColumns={{ base: "1fr", lg: "1fr 320px" }} gap={6} alignItems="start">
          <GridItem>
            <Stack spacing={8}>
              {/* Working Deals */}
              <Box>
                <SectionHeader title="Working deals" count={view.counts.deals} />
                {view.deals.length === 0 ? (
                  <EmptySection>No open deals right now.</EmptySection>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {view.deals.map((d) => (
                      <DealCard key={d.id} deal={d} />
                    ))}
                  </SimpleGrid>
                )}
              </Box>

              {/* Open Leads */}
              <Box>
                <SectionHeader title="Open leads" count={view.counts.leads} />
                {view.leads.length === 0 ? (
                  <EmptySection>No marketing-qualified leads waiting.</EmptySection>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {view.leads.map((l) => (
                      <LeadCard key={l.id} lead={l} />
                    ))}
                  </SimpleGrid>
                )}
              </Box>
            </Stack>
          </GridItem>

          {/* Right rail: companies + activity */}
          <GridItem>
            <Stack spacing={6}>
              <Box>
                <SectionHeader title="Companies" count={view.counts.accounts} />
                <CompaniesRail accounts={view.accounts} />
              </Box>
              <ActivityFeed actions={actions} />
            </Stack>
          </GridItem>
        </Grid>
      )}
    </AssistShell>
  );
}

export default DashboardLayout()(DashboardClient);

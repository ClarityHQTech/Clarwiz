"use client";

import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import RecomputeButton from "./RecomputeButton";

/** Shown when a deal has no DealInsight yet — invites the AE to analyze it. */
export default function EmptyInsight({ dealId }) {
  return (
    <Box borderWidth="1px" borderStyle="dashed" borderRadius="lg" bg="white" p={10} textAlign="center">
      <VStack spacing={4}>
        <Heading size="md">No analysis yet</Heading>
        <Text color="gray.500" maxW="md">
          This deal hasn&apos;t been analyzed. Run the intelligence engine to generate a briefing,
          GTM paths, signals, and next best actions.
        </Text>
        <RecomputeButton dealId={dealId} label="Analyze this deal" size="md" />
      </VStack>
    </Box>
  );
}

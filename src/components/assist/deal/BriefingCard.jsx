"use client";

import { Badge, Box, Divider, Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";

function Section({ label, children }) {
  if (!children) return null;
  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color="gray.500" letterSpacing="wide" mb={1}>
        {label}
      </Text>
      <Text color="gray.700" fontSize="sm" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  );
}

/** Insight briefing (W1): summary, coach voice, detected insight + meters. */
export default function BriefingCard({ vm }) {
  const { briefing, insightDetected, likelihoodToProgress, followUpEffort } = vm;

  const hasAny =
    briefing.briefSummary ||
    briefing.accountLevelBriefing ||
    briefing.coachSpeaks ||
    insightDetected.label ||
    likelihoodToProgress ||
    followUpEffort;

  if (!hasAny) {
    return (
      <Box borderWidth="1px" borderRadius="lg" bg="white" p={5}>
        <Heading size="sm" mb={2}>
          Briefing
        </Heading>
        <Text color="gray.500" fontSize="sm">
          No briefing has been generated for this deal yet.
        </Text>
      </Box>
    );
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={5}>
      <Heading size="sm" mb={4}>
        Briefing
      </Heading>
      <Stack spacing={4}>
        <Section label="Summary">{briefing.briefSummary}</Section>
        <Section label="Account briefing">{briefing.accountLevelBriefing}</Section>

        {insightDetected.label && (
          <Box bg="orange.50" borderRadius="md" p={3}>
            <HStack mb={1}>
              <Badge colorScheme="orange">AURA insight</Badge>
              <Text fontWeight="semibold" fontSize="sm">
                {insightDetected.label}
              </Text>
            </HStack>
            {insightDetected.explanation && (
              <Text fontSize="sm" color="gray.700">
                {insightDetected.explanation}
              </Text>
            )}
          </Box>
        )}

        {briefing.coachSpeaks && (
          <Box borderLeftWidth="3px" borderColor="orange.300" pl={3}>
            <Text fontSize="xs" fontWeight="semibold" color="orange.600" mb={1}>
              Your coach speaks
            </Text>
            <Text fontSize="sm" color="gray.700" fontStyle="italic">
              {briefing.coachSpeaks}
            </Text>
          </Box>
        )}

        {(likelihoodToProgress || followUpEffort) && (
          <>
            <Divider />
            <HStack spacing={6}>
              {likelihoodToProgress && (
                <VStack align="flex-start" spacing={0}>
                  <Text fontSize="xs" color="gray.500">
                    Likelihood to progress
                  </Text>
                  <Text fontWeight="semibold">{likelihoodToProgress}</Text>
                </VStack>
              )}
              {followUpEffort && (
                <VStack align="flex-start" spacing={0}>
                  <Text fontSize="xs" color="gray.500">
                    Follow-up effort
                  </Text>
                  <Text fontWeight="semibold">{followUpEffort}</Text>
                </VStack>
              )}
            </HStack>
          </>
        )}
      </Stack>
    </Box>
  );
}

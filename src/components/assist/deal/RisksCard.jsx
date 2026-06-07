"use client";

import { Box, Heading, HStack, List, ListItem, Stack, Text } from "@chakra-ui/react";

/** Risks (early warning signals), wins (positive outcomes), and coaching tip. */
export default function RisksCard({ earlyWarnings, positiveOutcomes, coachingTip }) {
  const hasAny = earlyWarnings.length || positiveOutcomes.length || coachingTip;
  if (!hasAny) return null;

  return (
    <Stack spacing={4}>
      {positiveOutcomes.length > 0 && (
        <Box borderWidth="1px" borderRadius="lg" bg="white" p={5}>
          <Heading size="sm" mb={3} color="green.600">
            What&apos;s going well
          </Heading>
          <List spacing={2}>
            {positiveOutcomes.map((o, i) => (
              <ListItem key={i} fontSize="sm">
                <Text as="span" color="green.500" fontWeight="bold" mr={2}>
                  ✓
                </Text>
                {o}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {earlyWarnings.length > 0 && (
        <Box borderWidth="1px" borderRadius="lg" bg="white" borderColor="red.100" p={5}>
          <Heading size="sm" mb={3} color="red.600">
            Early warning signals
          </Heading>
          <List spacing={2}>
            {earlyWarnings.map((w, i) => (
              <ListItem key={i} fontSize="sm">
                <Text as="span" color="red.500" fontWeight="bold" mr={2}>
                  ⚠
                </Text>
                {w}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {coachingTip && (
        <Box borderWidth="1px" borderRadius="lg" bg="orange.50" borderColor="orange.200" p={5}>
          <HStack mb={2}>
            <Heading size="sm" color="orange.700">
              Coaching tip
            </Heading>
          </HStack>
          <Text fontSize="sm" color="gray.700">
            {coachingTip}
          </Text>
        </Box>
      )}
    </Stack>
  );
}

"use client";

import { Badge, Box, Flex, Heading, HStack, Text, Tooltip } from "@chakra-ui/react";

const TYPE_COLORS = {
  intent: "purple",
  risk: "red",
  engagement: "blue",
  buying: "green",
  technical: "cyan",
};

function tierColor(tier) {
  const t = (tier || "").toLowerCase();
  if (t === "hot") return "red";
  if (t === "warm") return "orange";
  return "gray";
}

/** Horizontal strip of deal-level signals with type badges. */
export default function SignalsStrip({ signals }) {
  if (!signals?.length) return null;

  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={4}>
      <Heading size="xs" textTransform="uppercase" color="gray.500" mb={3} letterSpacing="wide">
        Signals
      </Heading>
      <Flex gap={3} wrap="wrap">
        {signals.map((s) => (
          <Tooltip
            key={s.id}
            label={s.evidence || s.suggestedAngle || ""}
            hasArrow
            isDisabled={!s.evidence && !s.suggestedAngle}
          >
            <Box borderWidth="1px" borderRadius="md" px={3} py={2} minW="180px" maxW="280px" bg="gray.50">
              <HStack mb={1} spacing={2}>
                <Badge colorScheme={TYPE_COLORS[(s.type || "").toLowerCase()] || "gray"}>{s.type || "signal"}</Badge>
                {s.tier && <Badge colorScheme={tierColor(s.tier)} variant="subtle">{s.tier}</Badge>}
                {typeof s.score === "number" && (
                  <Text fontSize="xs" color="gray.500" ml="auto">
                    {s.score}
                  </Text>
                )}
              </HStack>
              <Text fontSize="sm" fontWeight="medium" noOfLines={2}>
                {s.headline || s.category || "Signal"}
              </Text>
            </Box>
          </Tooltip>
        ))}
      </Flex>
    </Box>
  );
}

"use client";

import { Badge, Box, HStack, Heading, Stack, Text } from "@chakra-ui/react";
import {
  FiMail,
  FiMessageSquare,
  FiPhone,
  FiLinkedin,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiActivity,
} from "react-icons/fi";

const CHANNEL_ICON = {
  email: FiMail,
  sms: FiMessageSquare,
  whatsapp: FiMessageSquare,
  call: FiPhone,
  phone: FiPhone,
  linkedin: FiLinkedin,
};

function channelIcon(channel) {
  return CHANNEL_ICON[String(channel || "").toLowerCase()] || FiActivity;
}

function formatTs(ts) {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * TOFU outreach timeline (Mode-3 enrichment). Entries are already newest-first
 * from getTofuTimeline. When the lead matched no Clarwiz outreach, `entries` is
 * empty and we render an empty-state notice — NOT an error.
 */
export default function TofuTimeline({ entries = [] }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={5}>
      <Heading size="sm" mb={4} letterSpacing="tight">
        TOFU Outreach History
      </Heading>

      {entries.length === 0 ? (
        <Text color="gray.500" fontSize="sm">
          No Clarwiz outreach history.
        </Text>
      ) : (
        <Stack spacing={0}>
          {entries.map((e, i) => {
            const Icon = channelIcon(e.channel);
            const inbound = e.direction === "inbound";
            const DirIcon = inbound ? FiArrowDownLeft : FiArrowUpRight;
            return (
              <HStack
                key={`${e.id}-${e.direction}-${i}`}
                align="flex-start"
                spacing={3}
                py={3}
                borderTopWidth={i === 0 ? 0 : "1px"}
                borderColor="gray.100"
              >
                <Box
                  mt={0.5}
                  p={2}
                  rounded="full"
                  bg={inbound ? "green.50" : "orange.50"}
                  color={inbound ? "green.600" : "orange.600"}
                >
                  <Box as={Icon} boxSize={4} />
                </Box>
                <Stack spacing={1} flex="1" minW={0}>
                  <HStack spacing={2} wrap="wrap">
                    <Box as={DirIcon} color={inbound ? "green.500" : "orange.500"} boxSize={3.5} />
                    <Text fontWeight="semibold" fontSize="sm" textTransform="capitalize">
                      {e.channel || "activity"}
                    </Text>
                    <Badge
                      colorScheme={inbound ? "green" : "gray"}
                      rounded="md"
                      fontSize="0.7em"
                    >
                      {inbound ? "Reply" : "Sent"}
                    </Badge>
                    {e.status && (
                      <Badge colorScheme="orange" variant="subtle" rounded="md" fontSize="0.7em">
                        {e.status}
                      </Badge>
                    )}
                  </HStack>
                  {e.subject && (
                    <Text fontSize="sm" color="gray.800" noOfLines={1}>
                      {e.subject}
                    </Text>
                  )}
                  {e.cta && (
                    <Text fontSize="xs" color="orange.600">
                      CTA: {e.cta}
                    </Text>
                  )}
                  <Text fontSize="xs" color="gray.400">
                    {formatTs(e.timestamp)}
                  </Text>
                </Stack>
              </HStack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

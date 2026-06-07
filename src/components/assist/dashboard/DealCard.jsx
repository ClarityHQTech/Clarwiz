"use client";

import NextLink from "next/link";
import { Badge, HStack, LinkBox, LinkOverlay, Text, VStack } from "@chakra-ui/react";
import { formatAmount, stageColor, formatStaleness } from "./dashboardView";

/**
 * One open deal row → links to /assist/deal/[id]. Shows stage + amount badges
 * and a last-activity staleness chip.
 * deal = Deal { id, name, stageLabel, stageBand, amount, score, lastActivityAt, account{company{name}} }
 */
export default function DealCard({ deal }) {
  const company = deal.account?.company?.name;

  return (
    <LinkBox
      as="article"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="lg"
      p={4}
      bg="white"
      transition="all .12s"
      _hover={{ borderColor: "orange.300", shadow: "sm" }}
    >
      <HStack justify="space-between" align="start" mb={1}>
        <VStack align="start" spacing={0.5} minW={0}>
          <LinkOverlay as={NextLink} href={`/assist/deal/${deal.id}`}>
            <Text fontWeight="semibold" noOfLines={1}>
              {deal.name || "Untitled deal"}
            </Text>
          </LinkOverlay>
          {company && (
            <Text fontSize="sm" color="gray.600" noOfLines={1}>
              {company}
            </Text>
          )}
        </VStack>
        <Text fontWeight="bold" color="gray.800" flexShrink={0}>
          {formatAmount(deal.amount)}
        </Text>
      </HStack>

      <HStack spacing={2} mt={2} wrap="wrap">
        {deal.stageLabel && (
          <Badge colorScheme={stageColor(deal.stageBand)}>{deal.stageLabel}</Badge>
        )}
        {typeof deal.score === "number" && (
          <Badge colorScheme="orange" variant="subtle">
            Score {deal.score}
          </Badge>
        )}
        <Text fontSize="xs" color="gray.400" ml="auto">
          {formatStaleness(deal.lastActivityAt)}
        </Text>
      </HStack>
    </LinkBox>
  );
}

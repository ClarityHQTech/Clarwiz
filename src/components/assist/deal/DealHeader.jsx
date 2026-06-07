"use client";

import {
  Badge,
  Box,
  Circle,
  Flex,
  Heading,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from "@chakra-ui/react";

function fmtAmount(amount) {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

function fmtDate(d) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scoreColor(score) {
  if (score === null || score === undefined) return "gray";
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

function ScoreGauge({ score, label }) {
  const color = scoreColor(score);
  return (
    <VStack spacing={1}>
      <Circle
        size="64px"
        borderWidth="4px"
        borderColor={`${color}.400`}
        color={`${color}.600`}
        fontWeight="bold"
        fontSize="lg"
      >
        {score ?? "—"}
      </Circle>
      <Text fontSize="xs" color="gray.500">
        {label}
      </Text>
    </VStack>
  );
}

export default function DealHeader({ deal, accountName, accountScore }) {
  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={5} mb={5}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={4}>
        <Box>
          {accountName && (
            <Text fontSize="sm" color="gray.500" mb={1}>
              {accountName}
            </Text>
          )}
          <Heading size="lg" letterSpacing="tight">
            {deal?.name ?? "Untitled deal"}
          </Heading>
          <HStack mt={3} spacing={4} wrap="wrap">
            <Stat flex="0 0 auto">
              <StatLabel color="gray.500">Amount</StatLabel>
              <StatNumber fontSize="xl">{fmtAmount(deal?.amount)}</StatNumber>
            </Stat>
            {deal?.stageLabel && (
              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>
                  Stage
                </Text>
                <Badge colorScheme="orange" fontSize="sm" px={2} py={1} borderRadius="md">
                  {deal.stageLabel}
                </Badge>
              </Box>
            )}
            <Box>
              <Text fontSize="xs" color="gray.500" mb={1}>
                Status
              </Text>
              <Badge colorScheme={deal?.status === "OPEN" ? "green" : "gray"}>{deal?.status ?? "—"}</Badge>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" mb={1}>
                Last activity
              </Text>
              <Text fontSize="sm">{fmtDate(deal?.lastActivityAt)}</Text>
            </Box>
          </HStack>
        </Box>

        <HStack spacing={5}>
          {deal?.score !== null && deal?.score !== undefined && <ScoreGauge score={deal.score} label="Deal score" />}
          <ScoreGauge score={accountScore} label="Account score" />
        </HStack>
      </Flex>
    </Box>
  );
}

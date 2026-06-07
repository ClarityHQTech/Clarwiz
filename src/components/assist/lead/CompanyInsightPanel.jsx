"use client";

import { Badge, Box, HStack, Heading, List, ListIcon, ListItem, Stack, Text } from "@chakra-ui/react";
import { FiZap } from "react-icons/fi";

function asString(v) {
  return typeof v === "string" && v.trim() ? v : null;
}
function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function pluck(rows, key) {
  return asArray(rows)
    .map((r) => (r && typeof r === "object" ? asString(r[key]) : asString(r)))
    .filter(Boolean);
}

/**
 * Company-level AURA insight panel. Reads CompanyInsight.payload defensively —
 * every field is optional and the panel degrades to a compute notice when no
 * insight has been stored yet.
 */
export default function CompanyInsightPanel({ insight, company, account }) {
  const payload = insight?.payload && typeof insight.payload === "object" ? insight.payload : null;
  const companyName = company?.name || account?.payload?.name || "Company";

  if (!payload) {
    return (
      <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={5}>
        <Heading size="sm" mb={1}>
          {companyName}
        </Heading>
        <Text color="gray.500" fontSize="sm">
          No company insight computed yet.
        </Text>
      </Box>
    );
  }

  const summary =
    asString(payload.account_level_briefing) ||
    asString(payload.brief_summary) ||
    asString(payload.summary);
  const detected =
    payload.aura_insight_detected && typeof payload.aura_insight_detected === "object"
      ? payload.aura_insight_detected
      : {};
  const insightLabel = asString(detected.insight_label);
  const insightExplanation = asString(detected.insight_explanation);
  const score =
    typeof payload.account_score === "number" ? payload.account_score : null;
  const positives = pluck(payload.positive_outcomes_observed, "outcome");
  const warnings = pluck(payload.early_warning_signal, "warning_signal");

  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={5}>
      <HStack justify="space-between" mb={3} align="flex-start">
        <Heading size="sm" letterSpacing="tight">
          {companyName}
        </Heading>
        {score !== null && (
          <Badge colorScheme="orange" rounded="md" fontSize="0.8em">
            Score {score}
          </Badge>
        )}
      </HStack>

      <Stack spacing={4}>
        {summary && (
          <Text color="gray.700" fontSize="sm" whiteSpace="pre-wrap">
            {summary}
          </Text>
        )}

        {(insightLabel || insightExplanation) && (
          <Box bg="orange.50" rounded="md" p={3}>
            {insightLabel && (
              <HStack spacing={2} mb={1}>
                <Box as={FiZap} color="orange.500" />
                <Text fontWeight="semibold" fontSize="sm" color="orange.700">
                  {insightLabel}
                </Text>
              </HStack>
            )}
            {insightExplanation && (
              <Text fontSize="sm" color="gray.700">
                {insightExplanation}
              </Text>
            )}
          </Box>
        )}

        {positives.length > 0 && (
          <Box>
            <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1} textTransform="uppercase">
              Positive signals
            </Text>
            <List spacing={1}>
              {positives.map((p, i) => (
                <ListItem key={i} fontSize="sm" color="gray.700">
                  <ListIcon as={FiZap} color="green.500" />
                  {p}
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {warnings.length > 0 && (
          <Box>
            <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1} textTransform="uppercase">
              Watch-outs
            </Text>
            <List spacing={1}>
              {warnings.map((w, i) => (
                <ListItem key={i} fontSize="sm" color="gray.700">
                  <ListIcon as={FiZap} color="red.400" />
                  {w}
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

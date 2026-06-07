"use client";

import NextLink from "next/link";
import { Badge, Box, HStack, LinkBox, LinkOverlay, Text, VStack } from "@chakra-ui/react";

/**
 * One MQL contact row → links to /assist/lead/[id].
 * lead = Contact { id, lifecycleStage, businessUser{ name, jobTitle, email, company{name} } }
 */
export default function LeadCard({ lead }) {
  const bu = lead.businessUser ?? {};
  const name = bu.name || bu.email || "Unknown lead";
  const company = bu.company?.name;

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
      <HStack justify="space-between" align="start">
        <VStack align="start" spacing={0.5} minW={0}>
          <LinkOverlay as={NextLink} href={`/assist/lead/${lead.id}`}>
            <Text fontWeight="semibold" noOfLines={1}>
              {name}
            </Text>
          </LinkOverlay>
          {bu.jobTitle && (
            <Text fontSize="sm" color="gray.500" noOfLines={1}>
              {bu.jobTitle}
            </Text>
          )}
          {company && (
            <Text fontSize="sm" color="gray.600" noOfLines={1}>
              {company}
            </Text>
          )}
        </VStack>
        <Badge colorScheme="green" flexShrink={0}>
          {lead.lifecycleStage === "lead" ? "Lead" : "MQL"}
        </Badge>
      </HStack>
      {bu.email && (
        <Box mt={2}>
          <Text fontSize="xs" color="gray.400" noOfLines={1}>
            {bu.email}
          </Text>
        </Box>
      )}
    </LinkBox>
  );
}

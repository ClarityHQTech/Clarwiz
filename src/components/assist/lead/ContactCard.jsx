"use client";

import { Avatar, Badge, Box, HStack, Heading, Link as CLink, Stack, Text } from "@chakra-ui/react";

const PERSONA_LABEL = {
  DECISION_MAKER: "Decision Maker",
  CHAMPION: "Champion",
  INFLUENCER: "Influencer",
  BLOCKER: "Blocker",
  END_USER: "End User",
  OTHER: "Contact",
};

/**
 * Lead identity card: name, title, persona, company, email/phone.
 * Defensive — businessUser/company may be partially populated.
 */
export default function ContactCard({ contact, businessUser, company }) {
  const bu = businessUser ?? contact?.businessUser ?? {};
  const co = company ?? bu.company ?? null;
  const name = bu.name || [bu.firstName, bu.lastName].filter(Boolean).join(" ") || "Unknown contact";
  const persona = PERSONA_LABEL[contact?.persona] ?? "Contact";

  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={5}>
      <HStack spacing={4} align="flex-start">
        <Avatar name={name} bg="orange.500" color="white" />
        <Stack spacing={1} flex="1" minW={0}>
          <HStack spacing={2} wrap="wrap">
            <Heading size="md" letterSpacing="tight" noOfLines={1}>
              {name}
            </Heading>
            <Badge colorScheme="orange" rounded="md">
              {persona}
            </Badge>
          </HStack>
          {bu.jobTitle && (
            <Text color="gray.600" fontSize="sm" noOfLines={1}>
              {bu.jobTitle}
              {co?.name ? ` · ${co.name}` : ""}
            </Text>
          )}
          {!bu.jobTitle && co?.name && (
            <Text color="gray.600" fontSize="sm" noOfLines={1}>
              {co.name}
            </Text>
          )}
          <Stack spacing={0.5} pt={1}>
            {bu.email && (
              <CLink href={`mailto:${bu.email}`} fontSize="sm" color="orange.600">
                {bu.email}
              </CLink>
            )}
            {bu.phone && (
              <Text fontSize="sm" color="gray.500">
                {bu.phone}
              </Text>
            )}
            {contact?.lifecycleStage && (
              <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wide">
                {contact.lifecycleStage}
              </Text>
            )}
          </Stack>
        </Stack>
      </HStack>
    </Box>
  );
}

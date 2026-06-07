"use client";

import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";

/**
 * One account row in the Companies rail. Clicking opens the CompanyDrawer
 * (handled by the parent via onOpen). Not a link — it's a drawer trigger.
 * account = Account { id, company{name,domain,industry}, _count{deals} }
 */
export default function CompanyCard({ account, onOpen }) {
  const company = account.company ?? {};
  const dealCount = account._count?.deals ?? 0;

  return (
    <Box
      as="button"
      type="button"
      onClick={() => onOpen?.(account)}
      textAlign="left"
      w="100%"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="lg"
      p={3.5}
      bg="white"
      transition="all .12s"
      _hover={{ borderColor: "orange.300", bg: "orange.50", shadow: "sm" }}
    >
      <HStack justify="space-between" align="start">
        <VStack align="start" spacing={0.5} minW={0}>
          <Text fontWeight="semibold" noOfLines={1}>
            {company.name || "Unknown company"}
          </Text>
          {company.industry && (
            <Text fontSize="xs" color="gray.500" noOfLines={1}>
              {company.industry}
            </Text>
          )}
          {company.domain && (
            <Text fontSize="xs" color="gray.400" noOfLines={1}>
              {company.domain}
            </Text>
          )}
        </VStack>
        <Badge colorScheme={dealCount > 0 ? "orange" : "gray"} flexShrink={0}>
          {dealCount} {dealCount === 1 ? "deal" : "deals"}
        </Badge>
      </HStack>
    </Box>
  );
}

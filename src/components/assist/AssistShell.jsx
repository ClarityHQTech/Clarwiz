"use client";

import NextLink from "next/link";
import { Box, Container, Flex, HStack, Heading, Link as CLink, Text } from "@chakra-ui/react";
import ChatDock from "@/components/assist/ChatDock";

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "/assist" },
  { key: "collaterals", label: "Collateral", href: "/assist/collaterals" },
  { key: "settings", label: "Settings", href: "/assist/settings" },
];

/**
 * Shared chrome for every /assist page. Wrap a page's body in:
 *   <AssistShell active="dashboard" title="…" actions={…}>…</AssistShell>
 * Pages are themselves exported via DashboardLayout()(Page) for app-level chrome.
 */
export default function AssistShell({ active, title, subtitle, actions, chatContext, children }) {
  return (
    <Box minH="100%">
      <Box borderBottomWidth="1px" borderColor="gray.200" bg="white" position="sticky" top={0} zIndex={2}>
        <Container maxW="7xl" py={3}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
            <HStack spacing={6} align="center">
              <Heading size="sm" color="orange.600" letterSpacing="tight">
                AE&nbsp;Assist
              </Heading>
              <HStack spacing={1}>
                {NAV.map((n) => {
                  const isActive = n.key === active;
                  return (
                    <CLink
                      as={NextLink}
                      key={n.key}
                      href={n.href}
                      px={3}
                      py={1.5}
                      rounded="md"
                      fontSize="sm"
                      fontWeight={isActive ? "semibold" : "medium"}
                      color={isActive ? "orange.700" : "gray.600"}
                      bg={isActive ? "orange.50" : "transparent"}
                      _hover={{ bg: "orange.50", color: "orange.700", textDecoration: "none" }}
                    >
                      {n.label}
                    </CLink>
                  );
                })}
              </HStack>
            </HStack>
            {actions}
          </Flex>
        </Container>
      </Box>

      <Container maxW="7xl" py={6}>
        {title && (
          <Box mb={5}>
            <Heading size="lg" letterSpacing="tight">
              {title}
            </Heading>
            {subtitle && (
              <Text color="gray.500" mt={1}>
                {subtitle}
              </Text>
            )}
          </Box>
        )}
        {children}
      </Container>

      <ChatDock pageContext={chatContext} />
    </Box>
  );
}

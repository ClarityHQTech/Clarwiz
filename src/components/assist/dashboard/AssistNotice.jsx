"use client";

import NextLink from "next/link";
import { Box, Button, Heading, Icon, Text } from "@chakra-ui/react";
import { FiLink, FiAlertCircle } from "react-icons/fi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";

const ICONS = { link: FiLink, alert: FiAlertCircle };

/**
 * Full-page notice inside the assist chrome — used for the "Connect HubSpot"
 * empty state and the "no active workspace" state.
 */
function AssistNotice({ title, message, ctaLabel, ctaHref, icon = "link" }) {
  return (
    <AssistShell active="dashboard" title="Your day">
      <Box
        borderWidth="1px"
        borderColor="gray.200"
        rounded="xl"
        bg="white"
        p={10}
        textAlign="center"
      >
        <Icon as={ICONS[icon] || FiLink} boxSize={10} color="orange.400" mb={4} />
        <Heading size="md" mb={2}>
          {title}
        </Heading>
        <Text color="gray.500" mb={6} maxW="md" mx="auto">
          {message}
        </Text>
        {ctaLabel && ctaHref && (
          <Button as={NextLink} href={ctaHref} colorScheme="orange">
            {ctaLabel}
          </Button>
        )}
      </Box>
    </AssistShell>
  );
}

export default DashboardLayout()(AssistNotice);

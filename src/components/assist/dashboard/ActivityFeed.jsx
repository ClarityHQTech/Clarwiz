"use client";

import { Badge, Box, Divider, HStack, Text, VStack } from "@chakra-ui/react";
import { formatStaleness } from "./dashboardView";

const ACTION_LABEL = {
  INSIGHT_COMPUTED: "Insight computed",
  NBA_DRAFTED: "Next-best-action drafted",
  NBA_EXECUTED: "Action executed",
  EMAIL_DRAFTED: "Email drafted",
  COLLATERAL_SENT: "Collateral sent",
  TASK_CREATED: "Task created",
  NOTE_ADDED: "Note added",
  DEAL_CREATED: "Deal created",
  MEETING_SCHEDULED: "Meeting scheduled",
  CHAT_QUERY: "Chat query",
};

const ACTION_COLOR = {
  INSIGHT_COMPUTED: "purple",
  NBA_DRAFTED: "orange",
  NBA_EXECUTED: "green",
  EMAIL_DRAFTED: "blue",
  COLLATERAL_SENT: "teal",
  DEAL_CREATED: "green",
};

/**
 * Right-rail activity feed from recentAssistActions().
 * actions = AssistActionLog[] { action, entityType, hsObjectId, createdAt }
 */
export default function ActivityFeed({ actions = [] }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={4} position="sticky" top="80px">
      <Text fontWeight="semibold" mb={3}>
        Recent activity
      </Text>
      {actions.length === 0 ? (
        <Text fontSize="sm" color="gray.400">
          No activity yet. Actions you take across the assist layer show up here.
        </Text>
      ) : (
        <VStack align="stretch" spacing={0} divider={<Divider />}>
          {actions.map((a) => (
            <Box key={a.id} py={2.5}>
              <HStack justify="space-between" align="start" spacing={2}>
                <VStack align="start" spacing={0.5} minW={0}>
                  <Badge colorScheme={ACTION_COLOR[a.action] || "gray"} variant="subtle">
                    {ACTION_LABEL[a.action] || a.action}
                  </Badge>
                  {a.entityType && (
                    <Text fontSize="xs" color="gray.500" noOfLines={1}>
                      {a.entityType}
                      {a.hsObjectId ? ` · ${a.hsObjectId}` : ""}
                    </Text>
                  )}
                </VStack>
                <Text fontSize="xs" color="gray.400" flexShrink={0}>
                  {formatStaleness(a.createdAt)}
                </Text>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}

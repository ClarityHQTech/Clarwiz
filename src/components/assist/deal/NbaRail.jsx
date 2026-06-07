"use client";

import { useState } from "react";
import { Badge, Box, Button, Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import NbaDrawer from "./NbaDrawer";

function statusColor(status) {
  switch (status) {
    case "EXECUTED":
      return "green";
    case "DRAFTED":
    case "APPROVED":
      return "blue";
    case "DISMISSED":
      return "gray";
    default:
      return "orange";
  }
}

/** Right-rail of NBA recommendations; each opens the execute/draft drawer. */
export default function NbaRail({ dealId, nbas, onRefresh }) {
  const [activeNba, setActiveNba] = useState(null);

  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={5}>
      <Heading size="sm" mb={4}>
        Next best actions
      </Heading>

      {!nbas?.length ? (
        <Text color="gray.500" fontSize="sm">
          No recommendations yet.
        </Text>
      ) : (
        <Stack spacing={3}>
          {nbas.map((nba) => (
            <Box key={nba.id} borderWidth="1px" borderRadius="md" p={3} _hover={{ borderColor: "orange.300" }}>
              <HStack justify="space-between" align="flex-start" mb={1}>
                <Text fontWeight="semibold" fontSize="sm">
                  {nba.title}
                </Text>
                <Badge colorScheme={statusColor(nba.status)}>{nba.status}</Badge>
              </HStack>
              <HStack spacing={2} mb={2}>
                {nba.actionType && (
                  <Badge variant="subtle" colorScheme="gray">
                    {nba.actionType}
                  </Badge>
                )}
                {typeof nba.score === "number" && (
                  <Text fontSize="xs" color="gray.500">
                    score {nba.score}
                  </Text>
                )}
              </HStack>
              {nba.rationale && (
                <Text fontSize="xs" color="gray.600" noOfLines={2} mb={2}>
                  {nba.rationale}
                </Text>
              )}
              <Button size="xs" colorScheme="orange" variant="outline" onClick={() => setActiveNba(nba)}>
                {nba.status === "EXECUTED" ? "View draft" : "Execute"}
              </Button>
            </Box>
          ))}
        </Stack>
      )}

      {activeNba && (
        <NbaDrawer
          dealId={dealId}
          nba={activeNba}
          isOpen={!!activeNba}
          onClose={() => setActiveNba(null)}
          onExecuted={onRefresh}
        />
      )}
    </Box>
  );
}

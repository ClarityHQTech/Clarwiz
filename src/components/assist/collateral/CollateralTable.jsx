"use client";

import {
  Badge,
  Box,
  Button,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Tag,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FiExternalLink } from "react-icons/fi";
import {
  TYPE_LABELS,
  STAGE_LABELS,
  SOURCE_LABELS,
  SOURCE_COLORS,
} from "./constants";

/**
 * Grid of collateral rows. Each row shows type/stage, source badge, context
 * chips (company/deal) and an "Open" action that hits the redirect route in a
 * new tab. Purely presentational.
 */
export default function CollateralTable({ items }) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.200" rounded="lg" overflowX="auto">
      <Table size="sm" variant="simple">
        <Thead bg="gray.50">
          <Tr>
            <Th>Title</Th>
            <Th>Type</Th>
            <Th>Stage</Th>
            <Th>Source</Th>
            <Th>Context</Th>
            <Th textAlign="right">Action</Th>
          </Tr>
        </Thead>
        <Tbody>
          {items.map((it) => (
            <Tr key={it.id} _hover={{ bg: "orange.50" }}>
              <Td>
                <Text fontWeight="semibold">{it.title}</Text>
                {it.tags?.length > 0 && (
                  <Wrap spacing={1} mt={1}>
                    {it.tags.map((t) => (
                      <WrapItem key={t}>
                        <Tag size="sm" colorScheme="orange" variant="subtle">
                          {t}
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
              </Td>
              <Td>
                <Text fontSize="sm">{TYPE_LABELS[it.type] ?? it.type}</Text>
              </Td>
              <Td>
                <Badge colorScheme="gray" variant="subtle">
                  {STAGE_LABELS[it.funnelStage] ?? it.funnelStage}
                </Badge>
              </Td>
              <Td>
                <Badge colorScheme={SOURCE_COLORS[it.source] ?? "gray"}>
                  {SOURCE_LABELS[it.source] ?? it.source}
                </Badge>
              </Td>
              <Td>
                <HStack spacing={1}>
                  {it.companyHsId && (
                    <Tag size="sm" variant="outline" colorScheme="blue">
                      Co {it.companyHsId}
                    </Tag>
                  )}
                  {it.dealHsId && (
                    <Tag size="sm" variant="outline" colorScheme="purple">
                      Deal {it.dealHsId}
                    </Tag>
                  )}
                  {!it.companyHsId && !it.dealHsId && (
                    <Text fontSize="xs" color="gray.400">
                      —
                    </Text>
                  )}
                </HStack>
              </Td>
              <Td textAlign="right">
                <Button
                  as="a"
                  href={`/api/assist/collateral/${it.id}/open`}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  colorScheme="orange"
                  variant="outline"
                  rightIcon={<FiExternalLink />}
                >
                  Open
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}

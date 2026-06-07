"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Center,
  Icon,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { FiPlus, FiFolder, FiZap } from "react-icons/fi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import FilterBar from "./FilterBar";
import CollateralTable from "./CollateralTable";
import RegisterModal from "./RegisterModal";
import GenerateCollateralModal from "./GenerateCollateralModal";

const INITIAL_FILTERS = { q: "", type: "", funnelStage: "", tag: "" };

/**
 * Collateral Hub client. Holds the row list + filter state, renders the
 * searchable/filterable grid, and the "Register collateral" modal. Exported
 * via DashboardLayout()(…) per the server-page / client-HOC split.
 */
function CollateralClient({ items: initialItems }) {
  const [items, setItems] = useState(initialItems ?? []);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const gen = useDisclosure();

  const tagOptions = useMemo(() => {
    const s = new Set();
    items.forEach((it) => (it.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((it) => {
      if (filters.type && it.type !== filters.type) return false;
      if (filters.funnelStage && it.funnelStage !== filters.funnelStage) return false;
      if (filters.tag && !(it.tags ?? []).includes(filters.tag)) return false;
      if (q) {
        const inTitle = it.title.toLowerCase().includes(q);
        const inTags = (it.tags ?? []).some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inTags) return false;
      }
      return true;
    });
  }, [items, filters]);

  const onRegistered = (item) => {
    if (!item) return;
    setItems((prev) => {
      const rest = prev.filter((p) => p.id !== item.id);
      const normalized = {
        ...item,
        tags: item.tags ?? [],
        createdAt:
          typeof item.createdAt === "string"
            ? item.createdAt
            : new Date(item.createdAt).toISOString(),
      };
      return [normalized, ...rest];
    });
  };

  // After AI generation the directory has a new GENERATED row — refetch the list.
  const onGenerated = async () => {
    try {
      const res = await fetch("/api/assist/collateral");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) setItems(data.items);
      }
    } catch {
      /* the row exists server-side; a refresh will surface it */
    }
  };

  const hasAny = items.length > 0;

  return (
    <AssistShell
      active="collaterals"
      title="Collateral Hub"
      subtitle="Marketing + sales collateral, with best-match suggestions for any deal."
      actions={
        <ButtonGroup spacing={2}>
          <Button colorScheme="orange" variant="outline" leftIcon={<FiZap />} onClick={gen.onOpen}>
            Generate with AI
          </Button>
          <Button colorScheme="orange" leftIcon={<FiPlus />} onClick={onOpen}>
            Register collateral
          </Button>
        </ButtonGroup>
      }
    >
      {hasAny && (
        <FilterBar filters={filters} onChange={setFilters} tagOptions={tagOptions} />
      )}

      {!hasAny ? (
        <Center
          bg="white"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="gray.300"
          rounded="lg"
          py={16}
          px={6}
        >
          <Stack spacing={3} align="center" textAlign="center" maxW="md">
            <Icon as={FiFolder} boxSize={8} color="orange.400" />
            <Text fontWeight="semibold">No collateral yet</Text>
            <Text color="gray.500" fontSize="sm">
              Register your first marketing or sales asset — a pitch deck, battlecard,
              case study, or one-pager — to surface it as a best-match suggestion on deals.
            </Text>
            <Button colorScheme="orange" leftIcon={<FiPlus />} onClick={onOpen}>
              Register collateral
            </Button>
          </Stack>
        </Center>
      ) : filtered.length === 0 ? (
        <Box bg="white" borderWidth="1px" borderColor="gray.200" rounded="lg" py={10}>
          <Text textAlign="center" color="gray.500" fontSize="sm">
            No collateral matches these filters.
          </Text>
        </Box>
      ) : (
        <CollateralTable items={filtered} />
      )}

      <RegisterModal isOpen={isOpen} onClose={onClose} onRegistered={onRegistered} />
      <GenerateCollateralModal isOpen={gen.isOpen} onClose={gen.onClose} onGenerated={onGenerated} />
    </AssistShell>
  );
}

export default DashboardLayout()(CollateralClient);

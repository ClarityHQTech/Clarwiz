"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Heading,
  HStack,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { toast } from "sonner";

/**
 * GTM paths rendered as a checkable taskbook. Selected steps are pushed to
 * HubSpot as tasks via POST /api/assist/deal/[id]/tasks.
 */
export default function GtmTaskbook({ dealId, gtmPaths }) {
  // selection keyed as `${pathIndex}:${stepIndex}`
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const stepsByKey = useMemo(() => {
    const map = {};
    gtmPaths.forEach((p) => {
      p.steps.forEach((step, si) => {
        map[`${p.index}:${si}`] = { subject: step, body: p.whyThisWorks ? `Why this works: ${p.whyThisWorks}` : "" };
      });
    });
    return map;
  }, [gtmPaths]);

  const selectedKeys = Object.keys(selected).filter((k) => selected[k]);

  const toggle = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }));

  const onCreate = async () => {
    const steps = selectedKeys.map((k) => stepsByKey[k]).filter(Boolean);
    if (!steps.length) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Settings to create tasks.");
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Failed to create tasks");
        return;
      }
      if (data.ok === false && data.reason === "write_scope") {
        toast.warning("Your HubSpot token lacks task write scope.");
        return;
      }
      const n = data.created?.length ?? 0;
      toast.success(`Created ${n} task${n === 1 ? "" : "s"} in HubSpot`);
      if (data.partial) toast.warning("Some tasks were blocked by HubSpot scopes.");
      setSelected({});
    } catch {
      toast.error("Failed to create tasks");
    } finally {
      setSubmitting(false);
    }
  };

  if (!gtmPaths.length) {
    return (
      <Box borderWidth="1px" borderRadius="lg" bg="white" p={5}>
        <Heading size="sm" mb={2}>
          GTM paths
        </Heading>
        <Text color="gray.500" fontSize="sm">
          No GTM paths suggested yet.
        </Text>
      </Box>
    );
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={5}>
      <HStack justify="space-between" mb={4} align="center">
        <Heading size="sm">GTM paths — taskbook</Heading>
        <Button
          size="sm"
          colorScheme="orange"
          onClick={onCreate}
          isLoading={submitting}
          isDisabled={!selectedKeys.length}
        >
          Create {selectedKeys.length || ""} task{selectedKeys.length === 1 ? "" : "s"}
        </Button>
      </HStack>

      <Stack spacing={5}>
        {gtmPaths.map((path) => (
          <Box key={path.index}>
            <HStack mb={2} align="center" spacing={2}>
              <Text fontWeight="semibold" fontSize="sm">
                {path.title}
              </Text>
              {path.scoreImpact !== null && (
                <Badge colorScheme="green">+{path.scoreImpact}</Badge>
              )}
            </HStack>
            {path.whyThisWorks && (
              <Text fontSize="xs" color="gray.500" mb={2}>
                {path.whyThisWorks}
              </Text>
            )}
            <VStack align="stretch" spacing={1.5} pl={1}>
              {path.steps.length ? (
                path.steps.map((step, si) => {
                  const key = `${path.index}:${si}`;
                  return (
                    <Checkbox
                      key={key}
                      colorScheme="orange"
                      isChecked={!!selected[key]}
                      onChange={() => toggle(key)}
                    >
                      <Text fontSize="sm">{step}</Text>
                    </Checkbox>
                  );
                })
              ) : (
                <Text fontSize="xs" color="gray.400">
                  No steps listed.
                </Text>
              )}
            </VStack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

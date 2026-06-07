"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Heading,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiZap } from "react-icons/fi";
import { toast } from "sonner";
import { formatAmount, stageColor } from "./dashboard/dashboardView";

/**
 * Company drawer for the AE dashboard. Given an accountId it lazily fetches
 * /api/assist/account/[id]/view and renders the company brief + signals +
 * contacts + deals, with an "Analyze" CTA that POSTs the F2 recompute endpoint.
 */
export default function CompanyDrawer({ accountId, isOpen, onClose }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const loadView = useCallback(async (id) => {
    setLoading(true);
    setView(null);
    try {
      const res = await fetch(`/api/assist/account/${id}/view`);
      if (!res.ok) {
        toast.error("Could not load company");
        return;
      }
      const data = await res.json();
      setView(data.view);
    } catch {
      toast.error("Could not load company");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && accountId) loadView(accountId);
  }, [isOpen, accountId, loadView]);

  const onAnalyze = async () => {
    if (!accountId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/assist/account/${accountId}/recompute`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Analysis failed — please try again.");
        return;
      }
      toast.success("Account analyzed");
      await loadView(accountId);
      router.refresh();
    } catch {
      toast.error("Analysis failed — please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const company = view?.company ?? {};
  const insight = view?.insight ?? null;
  const signals = view?.signals ?? [];
  const contacts = view?.contacts ?? [];
  const deals = view?.deals ?? [];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="md" placement="right">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader borderBottomWidth="1px">
          <Text noOfLines={1}>{company.name || "Company"}</Text>
          {company.domain && (
            <Text fontSize="sm" color="gray.500" fontWeight="normal">
              {company.domain}
            </Text>
          )}
        </DrawerHeader>

        <DrawerBody>
          {loading ? (
            <Flex justify="center" py={10}>
              <Spinner color="orange.500" />
            </Flex>
          ) : !view ? (
            <Text color="gray.500" py={6}>
              Nothing to show.
            </Text>
          ) : (
            <Stack spacing={6} py={2}>
              {/* Company brief */}
              <Box>
                <HStack spacing={2} mb={2}>
                  {company.industry && <Badge colorScheme="gray">{company.industry}</Badge>}
                  <Badge colorScheme="orange" variant="subtle">
                    {deals.length} {deals.length === 1 ? "deal" : "deals"}
                  </Badge>
                </HStack>
              </Box>

              {/* Insight / Analyze CTA */}
              <Box borderWidth="1px" borderColor="gray.200" rounded="lg" p={4} bg="gray.50">
                <Flex justify="space-between" align="center" mb={insight ? 3 : 0}>
                  <Heading size="sm">Intelligence</Heading>
                  <Button
                    size="xs"
                    colorScheme="orange"
                    variant={insight ? "outline" : "solid"}
                    leftIcon={<FiZap />}
                    onClick={onAnalyze}
                    isLoading={analyzing}
                    loadingText="Analyzing…"
                  >
                    {insight ? "Re-analyze" : "Analyze this account"}
                  </Button>
                </Flex>
                {insight ? (
                  <Text fontSize="sm" color="gray.700" whiteSpace="pre-wrap">
                    {insight.summary || insight.narrative || "Insight computed."}
                  </Text>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    No intelligence yet. Run an analysis to generate a brief, signals and
                    recommendations for this account.
                  </Text>
                )}
              </Box>

              {/* Signals */}
              {signals.length > 0 && (
                <Box>
                  <Heading size="sm" mb={2}>
                    Signals
                  </Heading>
                  <VStack align="stretch" spacing={2} divider={<Divider />}>
                    {signals.map((s) => (
                      <HStack key={s.id} justify="space-between" align="start">
                        <Text fontSize="sm" color="gray.700" noOfLines={2}>
                          {s.label || s.kind || "Signal"}
                        </Text>
                        {typeof s.score === "number" && (
                          <Badge colorScheme="purple" variant="subtle" flexShrink={0}>
                            {s.score}
                          </Badge>
                        )}
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}

              {/* Deals */}
              {deals.length > 0 && (
                <Box>
                  <Heading size="sm" mb={2}>
                    Deals
                  </Heading>
                  <VStack align="stretch" spacing={2}>
                    {deals.map((d) => (
                      <HStack
                        key={d.id}
                        justify="space-between"
                        borderWidth="1px"
                        borderColor="gray.200"
                        rounded="md"
                        px={3}
                        py={2}
                      >
                        <VStack align="start" spacing={0.5} minW={0}>
                          <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                            {d.name || "Untitled deal"}
                          </Text>
                          {d.stageLabel && (
                            <Badge size="sm" colorScheme={stageColor(d.stageBand)}>
                              {d.stageLabel}
                            </Badge>
                          )}
                        </VStack>
                        <Text fontSize="sm" fontWeight="semibold" flexShrink={0}>
                          {formatAmount(d.amount)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}

              {/* Contacts */}
              {contacts.length > 0 && (
                <Box>
                  <Heading size="sm" mb={2}>
                    Contacts
                  </Heading>
                  <VStack align="stretch" spacing={1}>
                    {contacts.map((c) => {
                      const bu = c.businessUser ?? {};
                      return (
                        <HStack key={c.id} justify="space-between">
                          <Text fontSize="sm" noOfLines={1}>
                            {bu.name || bu.email || "Contact"}
                          </Text>
                          {bu.jobTitle && (
                            <Text fontSize="xs" color="gray.500" noOfLines={1} flexShrink={0}>
                              {bu.jobTitle}
                            </Text>
                          )}
                        </HStack>
                      );
                    })}
                  </VStack>
                </Box>
              )}
            </Stack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

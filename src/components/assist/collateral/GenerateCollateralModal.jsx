"use client";

import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from "@chakra-ui/react";
import { toast } from "sonner";

const EMPTY = { dealId: "", accountId: "", nbaId: "", title: "" };

function scoreColor(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return "gray";
  if (n >= 80) return "green";
  if (n >= 50) return "orange";
  return "red";
}

/**
 * "Generate with AI" modal. POSTs /api/assist/collateral/generate with a
 * deal / account / nba reference, then fetches the stored Document and shows a
 * read-only preview of the compliance score + generated template/data.
 *
 * NOTE: Live React rendering of the generated Tailspin component is out of
 * scope — this preview is the raw template + data only.
 */
export default function GenerateCollateralModal({ isOpen, onClose, onGenerated }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { compliance, document }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    setForm(EMPTY);
    setResult(null);
    onClose();
  };

  const submit = async () => {
    if (!form.dealId.trim() && !form.accountId.trim() && !form.nbaId.trim()) {
      toast.error("Provide a deal, account, or NBA id");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assist/collateral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: form.dealId.trim() || undefined,
          accountId: form.accountId.trim() || undefined,
          nbaId: form.nbaId.trim() || undefined,
          title: form.title.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === "generation_failed"
            ? "AI generation failed — try again"
            : data.error === "anthropic_not_configured" || data.error === "integration_missing"
              ? "Collateral generation isn't set up for this workspace yet"
              : data.error || "Could not generate collateral";
        toast.error(msg);
        return;
      }

      toast.success("Collateral generated");
      onGenerated?.({ collateralId: data.collateralId, documentId: data.documentId });

      // Fetch the stored Document for a read-only preview.
      let document = null;
      try {
        const docRes = await fetch(`/api/assist/document/${data.documentId}`);
        if (docRes.ok) document = (await docRes.json()).document;
      } catch {
        /* preview is best-effort */
      }
      setResult({ compliance: data.compliance, document });
    } catch {
      toast.error("Could not generate collateral");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} isCentered size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Generate collateral with AI</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!result ? (
            <Stack spacing={4}>
              <Text color="gray.500" fontSize="sm">
                Reference a deal, account, or next best action. AURA builds an on-brand
                one-pager from your company + prospect data.
              </Text>
              <FormControl>
                <FormLabel>Deal id</FormLabel>
                <Input value={form.dealId} onChange={set("dealId")} placeholder="optional" />
              </FormControl>
              <FormControl>
                <FormLabel>Account id</FormLabel>
                <Input value={form.accountId} onChange={set("accountId")} placeholder="optional" />
              </FormControl>
              <FormControl>
                <FormLabel>NBA id</FormLabel>
                <Input value={form.nbaId} onChange={set("nbaId")} placeholder="optional" />
                <FormHelperText>At least one of deal / account / NBA is required.</FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>Title</FormLabel>
                <Input value={form.title} onChange={set("title")} placeholder="optional override" />
              </FormControl>
            </Stack>
          ) : (
            <Stack spacing={4}>
              <Box>
                <Text fontSize="sm" color="gray.500" mb={1}>
                  Compliance
                </Text>
                <Stack direction="row" align="center" spacing={3}>
                  <Badge colorScheme={scoreColor(result.compliance?.score)} fontSize="md" px={2}>
                    {result.compliance?.score ?? "—"}
                  </Badge>
                  <Text fontSize="sm">{result.compliance?.note}</Text>
                </Stack>
              </Box>

              {result.document && (
                <>
                  <Divider />
                  <Box>
                    <Heading size="xs" mb={2}>
                      {result.document.title}
                    </Heading>
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Template (read-only — live render is out of scope)
                    </Text>
                    <Code
                      display="block"
                      whiteSpace="pre-wrap"
                      p={3}
                      rounded="md"
                      fontSize="xs"
                      maxH="200px"
                      overflowY="auto"
                    >
                      {result.document.template || "(empty)"}
                    </Code>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Data
                    </Text>
                    <Code
                      display="block"
                      whiteSpace="pre-wrap"
                      p={3}
                      rounded="md"
                      fontSize="xs"
                      maxH="200px"
                      overflowY="auto"
                    >
                      {JSON.stringify(result.document.data ?? {}, null, 2)}
                    </Code>
                  </Box>
                </>
              )}
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={close} isDisabled={submitting}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button colorScheme="orange" onClick={submit} isLoading={submitting}>
              Generate with AI
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

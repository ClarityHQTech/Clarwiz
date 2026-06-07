"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
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
  Textarea,
} from "@chakra-ui/react";
import { toast } from "sonner";

/**
 * Execute an NBA: calls the execute endpoint to draft an email, then shows the
 * draft in an editable modal (subject + HTML body). Save-to-clipboard for now;
 * sending is out of scope for W2.
 */
export default function NbaDrawer({ dealId, nba, isOpen, onClose, onExecuted }) {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [drafted, setDrafted] = useState(false);

  // Pre-load any existing draft when opening.
  useEffect(() => {
    if (!isOpen) return;
    const existing = nba?.draftPayload;
    if (existing?.emailHtml) {
      setSubject(existing.subject || "");
      setEmailHtml(existing.emailHtml || "");
      setDrafted(true);
    } else {
      setSubject("");
      setEmailHtml("");
      setDrafted(false);
    }
  }, [isOpen, nba]);

  const runDraft = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/nba/${nba.id}/execute`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast.error(data.reason || data.error || "Drafting failed");
        return;
      }
      setSubject(data.draft?.subject || "");
      setEmailHtml(data.draft?.emailHtml || "");
      setDrafted(true);
      toast.success(data.alreadyExecuted ? "Loaded existing draft" : "Email drafted");
      onExecuted?.();
    } catch {
      toast.error("Drafting failed");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${emailHtml}`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{nba?.title || "Next best action"}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {nba?.rationale && (
            <Text fontSize="sm" color="gray.600" mb={4}>
              {nba.rationale}
            </Text>
          )}

          {!drafted ? (
            <Box textAlign="center" py={8}>
              <Text color="gray.500" mb={4} fontSize="sm">
                Generate a draft email for this action.
              </Text>
              <Button colorScheme="orange" onClick={runDraft} isLoading={loading}>
                Draft email
              </Button>
            </Box>
          ) : (
            <Stack spacing={4}>
              <FormControl>
                <FormLabel fontSize="sm">Subject</FormLabel>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Body (HTML)</FormLabel>
                <Textarea
                  value={emailHtml}
                  onChange={(e) => setEmailHtml(e.target.value)}
                  rows={12}
                  fontFamily="mono"
                  fontSize="sm"
                />
              </FormControl>
              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>
                  Preview
                </Text>
                <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50" dangerouslySetInnerHTML={{ __html: emailHtml }} />
              </Box>
            </Stack>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {drafted && (
            <>
              <Button variant="outline" onClick={runDraft} isLoading={loading}>
                Re-draft
              </Button>
              <Button colorScheme="orange" onClick={copy}>
                Copy
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

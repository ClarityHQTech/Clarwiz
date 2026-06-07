"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiMessageSquare, FiX, FiSend, FiRefreshCw } from "react-icons/fi";

/**
 * AE Chat Dock (C1) — floating, bottom-right in-Clarwiz copilot grounded in the
 * AE's CRM context + current page. Thread + history live in component state;
 * each send POSTs recent history + pageContext to /api/assist/chat.
 *
 * Mounted globally by AssistShell. `pageContext` defaults to the pipeline
 * overview when not on a focused entity page.
 *
 * Message shape: { id, role: 'user'|'assistant', content, status?: 'pending'|'error' }
 */
export default function ChatDock({ pageContext = { entityType: "pipeline" } }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadIdRef = useRef(`t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const listEndRef = useRef(null);

  useEffect(() => {
    if (open) listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // History of completed turns to send to the model (excludes pending/error).
  const buildHistory = useCallback(
    (extra = []) =>
      [...messages, ...extra]
        .filter((m) => m.status !== "pending" && m.status !== "error")
        .map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  const send = useCallback(
    async (text, opts = {}) => {
      const content = text.trim();
      if (!content || sending) return;

      const userMsg = { id: `u_${Date.now()}`, role: "user", content };
      const pendingId = `a_${Date.now()}`;
      // history = prior completed turns + this new user turn
      const history = [...buildHistory(), { role: "user", content }];

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: "assistant", content: "", status: "pending" },
      ]);
      if (!opts.keepInput) setInput("");
      setSending(true);

      try {
        const res = await fetch("/api/assist/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            pageContext,
            threadId: threadIdRef.current,
          }),
        });
        if (!res.ok) throw new Error(`chat_failed_${res.status}`);
        const data = await res.json();
        const reply = typeof data?.reply === "string" ? data.reply : "";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, content: reply, status: undefined } : m
          )
        );
      } catch {
        // Mark the user turn as failed for a retry affordance; drop the pending
        // bubble; do NOT clear the input (restore it so the AE can resend).
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== pendingId)
            .map((m) => (m.id === userMsg.id ? { ...m, status: "error" } : m))
        );
        setInput(content);
      } finally {
        setSending(false);
      }
    },
    [buildHistory, pageContext, sending]
  );

  const onSubmit = useCallback(
    (e) => {
      e?.preventDefault?.();
      send(input);
    },
    [input, send]
  );

  const retry = useCallback(
    (failed) => {
      // Remove the failed turn, then resend its content.
      setMessages((prev) => prev.filter((m) => m.id !== failed.id));
      send(failed.content, { keepInput: true });
    },
    [send]
  );

  if (!open) {
    return (
      <IconButton
        aria-label="Open AE Assist chat"
        icon={<FiMessageSquare />}
        colorScheme="orange"
        size="lg"
        isRound
        position="fixed"
        bottom={6}
        right={6}
        zIndex={1400}
        boxShadow="lg"
        onClick={() => setOpen(true)}
      />
    );
  }

  return (
    <Flex
      direction="column"
      position="fixed"
      bottom={6}
      right={6}
      zIndex={1400}
      w={{ base: "calc(100vw - 32px)", sm: "380px" }}
      maxW="380px"
      h="520px"
      maxH="calc(100vh - 48px)"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      boxShadow="2xl"
      overflow="hidden"
    >
      <HStack
        px={4}
        py={3}
        bg="orange.500"
        color="white"
        justify="space-between"
        flexShrink={0}
      >
        <HStack spacing={2}>
          <FiMessageSquare />
          <Text fontWeight="semibold" fontSize="sm">
            AE Assist
          </Text>
        </HStack>
        <IconButton
          aria-label="Close chat"
          icon={<FiX />}
          size="sm"
          variant="ghost"
          color="white"
          _hover={{ bg: "orange.600" }}
          onClick={() => setOpen(false)}
        />
      </HStack>

      <VStack
        align="stretch"
        spacing={3}
        flex="1"
        overflowY="auto"
        px={4}
        py={4}
        bg="gray.50"
      >
        {messages.length === 0 && (
          <Text fontSize="sm" color="gray.500" textAlign="center" mt={6}>
            Ask about this {pageContext?.entityType || "pipeline"} — deals, signals, next best actions.
          </Text>
        )}
        {messages.map((m) => {
          const isUser = m.role === "user";
          const isError = m.status === "error";
          return (
            <Box key={m.id} alignSelf={isUser ? "flex-end" : "flex-start"} maxW="85%">
              <Box
                px={3}
                py={2}
                borderRadius="lg"
                bg={isUser ? (isError ? "red.50" : "orange.500") : "white"}
                color={isUser && !isError ? "white" : "gray.800"}
                borderWidth={isUser && !isError ? 0 : "1px"}
                borderColor={isError ? "red.300" : "gray.200"}
                fontSize="sm"
                whiteSpace="pre-wrap"
              >
                {m.status === "pending" ? (
                  <HStack spacing={2} color="gray.500">
                    <Spinner size="xs" />
                    <Text>Thinking…</Text>
                  </HStack>
                ) : (
                  m.content
                )}
              </Box>
              {isError && (
                <HStack spacing={1} mt={1} justify="flex-end">
                  <Text fontSize="xs" color="red.500">
                    Failed to send
                  </Text>
                  <Button
                    size="xs"
                    variant="link"
                    colorScheme="orange"
                    leftIcon={<FiRefreshCw />}
                    onClick={() => retry(m)}
                  >
                    Retry
                  </Button>
                </HStack>
              )}
            </Box>
          );
        })}
        <div ref={listEndRef} />
      </VStack>

      <Box as="form" onSubmit={onSubmit} px={3} py={3} borderTopWidth="1px" borderColor="gray.200" flexShrink={0}>
        <HStack spacing={2}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AE Assist…"
            size="sm"
            borderRadius="md"
            isDisabled={sending}
            autoComplete="off"
          />
          <IconButton
            type="submit"
            aria-label="Send message"
            icon={<FiSend />}
            colorScheme="orange"
            size="sm"
            isLoading={sending}
            isDisabled={!input.trim()}
          />
        </HStack>
      </Box>
    </Flex>
  );
}

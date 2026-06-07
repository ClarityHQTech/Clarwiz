"use client";

import { useState } from "react";
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
} from "@chakra-ui/react";
import { toast } from "sonner";
import { TYPE_OPTIONS, SOURCE_OPTIONS, STAGE_OPTIONS } from "./constants";

const EMPTY = {
  title: "",
  type: "ONE_PAGER",
  source: "UPLOAD",
  funnelStage: "ANY",
  url: "",
  slug: "",
  tags: "",
  companyHsId: "",
  dealHsId: "",
};

/**
 * "Register collateral" modal. POSTs to /api/assist/collateral. Requires a
 * link (url) OR a slug — mirrors the route's `link_or_slug_required` rule.
 */
export default function RegisterModal({ isOpen, onClose, onRegistered }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    setForm(EMPTY);
    onClose();
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.url.trim() && !form.slug.trim()) {
      toast.error("Provide a link or a slug");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assist/collateral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          source: form.source,
          funnelStage: form.funnelStage,
          url: form.url.trim() || undefined,
          slug: form.slug.trim() || undefined,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          companyHsId: form.companyHsId.trim() || undefined,
          dealHsId: form.dealHsId.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not register collateral");
        return;
      }
      toast.success("Collateral registered");
      onRegistered?.(data.item);
      close();
    } catch {
      toast.error("Could not register collateral");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} isCentered size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Register collateral</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Title</FormLabel>
              <Input value={form.title} onChange={set("title")} autoFocus />
            </FormControl>

            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select value={form.type} onChange={set("type")}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Source</FormLabel>
                <Select value={form.source} onChange={set("source")}>
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Funnel stage</FormLabel>
                <Select value={form.funnelStage} onChange={set("funnelStage")}>
                  {STAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              <FormControl>
                <FormLabel>Slug</FormLabel>
                <Input value={form.slug} onChange={set("slug")} placeholder="q2-pricing-onepager" />
                <FormHelperText>HeyParrot viewer slug</FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>Link (URL)</FormLabel>
                <Input value={form.url} onChange={set("url")} placeholder="https://…" />
                <FormHelperText>Used when no slug</FormHelperText>
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Tags</FormLabel>
              <Input value={form.tags} onChange={set("tags")} placeholder="fintech, cfo, security" />
              <FormHelperText>Comma-separated; powers best-match ranking</FormHelperText>
            </FormControl>

            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              <FormControl>
                <FormLabel>Company HubSpot ID</FormLabel>
                <Input value={form.companyHsId} onChange={set("companyHsId")} placeholder="optional" />
              </FormControl>
              <FormControl>
                <FormLabel>Deal HubSpot ID</FormLabel>
                <Input value={form.dealHsId} onChange={set("dealHsId")} placeholder="optional" />
              </FormControl>
            </SimpleGrid>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={close} isDisabled={submitting}>
            Cancel
          </Button>
          <Button colorScheme="orange" onClick={submit} isLoading={submitting}>
            Register
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

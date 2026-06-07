"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { FiArrowUpRight } from "react-icons/fi";
import { toast } from "sonner";

/**
 * "Demo booked → Promote to Deal" action. Opens a modal pre-filled with a deal
 * name ("{Company} — Opportunity"), optional amount, POSTs to the promote route,
 * and on success routes to the newly created deal workroom.
 */
export default function PromoteButton({ contactId, companyName }) {
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const defaultName = `${companyName || "New"} — Opportunity`;
  const [dealname, setDealname] = useState(defaultName);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = () => {
    setDealname(defaultName);
    setAmount("");
    onOpen();
  };

  const submit = async () => {
    if (!dealname.trim()) {
      toast.error("Deal name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assist/lead/${contactId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealname: dealname.trim(),
          amount: amount.trim() ? Number(amount) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Could not promote this lead");
        return;
      }
      if (data.warning) toast.warning(data.warning);
      toast.success("Deal created");
      onClose();
      router.push(`/assist/deal/${data.dealId}`);
      router.refresh();
    } catch {
      toast.error("Could not promote this lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button colorScheme="orange" leftIcon={<FiArrowUpRight />} onClick={open} size="md">
        Demo booked → Promote to Deal
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Promote to Deal</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text color="gray.500" fontSize="sm" mb={4}>
              Creates a HubSpot deal in the first open stage, associates this contact
              {companyName ? " and company" : ""}, and links it back into Clarwiz.
            </Text>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Deal name</FormLabel>
                <Input value={dealname} onChange={(e) => setDealname(e.target.value)} autoFocus />
              </FormControl>
              <FormControl>
                <FormLabel>Amount (optional)</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none" color="gray.400">
                    $
                  </InputLeftElement>
                  <Input
                    type="number"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </InputGroup>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={submitting}>
              Cancel
            </Button>
            <Button colorScheme="orange" onClick={submit} isLoading={submitting}>
              Create deal
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

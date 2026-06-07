"use client";

import { useState } from "react";
import { Box, Button, Heading, HStack, Textarea } from "@chakra-ui/react";
import { toast } from "sonner";

/** Free-text note → written back to the deal in HubSpot. */
export default function NoteBox({ dealId }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Settings to add notes.");
        return;
      }
      if (!res.ok || data.ok === false) {
        if (data.reason === "write_scope") {
          toast.warning("Your HubSpot token lacks note write scope.");
        } else {
          toast.error(data.error || "Failed to add note");
        }
        return;
      }
      toast.success("Note added to HubSpot");
      setBody("");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={5}>
      <Heading size="sm" mb={3}>
        Add a note
      </Heading>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Log a quick update on this deal…"
        rows={4}
        mb={3}
      />
      <HStack justify="flex-end">
        <Button colorScheme="orange" onClick={onSave} isLoading={saving} isDisabled={!body.trim()}>
          Save to HubSpot
        </Button>
      </HStack>
    </Box>
  );
}

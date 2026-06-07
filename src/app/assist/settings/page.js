"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";

const EMPTY_FORM = {
  hubspotToken: "",
  hubspotPortalId: "",
  defaultOwnerId: "",
  insightModel: "",
};

function StatusBadge({ integration, loading }) {
  if (loading) return <Spinner size="sm" />;
  if (!integration?.configured) return <Badge colorScheme="gray">Not configured</Badge>;
  if (integration.status === "connected") return <Badge colorScheme="green">Connected</Badge>;
  if (integration.status === "error") return <Badge colorScheme="red">Test failed</Badge>;
  return <Badge colorScheme="yellow">Pending</Badge>;
}

function MofuSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState({ configured: false });
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assist/settings");
      const data = await res.json();
      setIntegration(data.integration ?? { configured: false });
    } catch {
      toast.error("Failed to load MOFU settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.hubspotToken.trim()) {
      toast.error("HubSpot token is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/assist/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      setIntegration(data.integration);
      setForm((f) => ({ ...f, hubspotToken: "" })); // never keep the raw token in state
      if (data.verified?.hubspot) {
        toast.success("HubSpot connected");
      } else {
        toast.warning("Saved, but the HubSpot test failed — check the token and scopes");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box maxW="640px" mx="auto" py={8} px={4}>
      <Heading size="lg" mb={1}>
        AE Assist — Settings
      </Heading>
      <Text color="gray.500" mb={6}>
        Connect HubSpot so the assist layer can read your deals, companies, and contacts.
      </Text>

      <Box borderWidth="1px" borderRadius="lg" p={6}>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">HubSpot</Heading>
          <StatusBadge integration={integration} loading={loading} />
        </HStack>

        {integration.configured && (
          <Text fontSize="sm" color="gray.500" mb={4}>
            Token {integration.hubspotTokenMasked} · Portal {integration.hubspotPortalId || "—"}
          </Text>
        )}

        <form onSubmit={onSave}>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>HubSpot private-app token</FormLabel>
              <Input
                type="password"
                placeholder="pat-naX-…"
                autoComplete="off"
                value={form.hubspotToken}
                onChange={onChange("hubspotToken")}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Portal ID (optional)</FormLabel>
              <Input value={form.hubspotPortalId} onChange={onChange("hubspotPortalId")} />
            </FormControl>
            <FormControl>
              <FormLabel>Default owner ID (optional)</FormLabel>
              <Input value={form.defaultOwnerId} onChange={onChange("defaultOwnerId")} />
            </FormControl>
            <FormControl>
              <FormLabel>Insight model (optional)</FormLabel>
              <Input
                placeholder="gpt-4o"
                value={form.insightModel}
                onChange={onChange("insightModel")}
              />
            </FormControl>
            <Button type="submit" colorScheme="orange" isLoading={saving} alignSelf="flex-start">
              {integration.configured ? "Update" : "Save & verify"}
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}

export default DashboardLayout()(MofuSettingsPage);

"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Checkbox,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineArrowPath } from "react-icons/hi2";
import { toast } from "sonner";
import {
  isWhatsAppTemplateAlreadyLinked,
  whatsAppTemplateKey,
} from "@/lib/whatsappCampaignTemplates";
import { parseWhatsAppTemplateVariableSlots } from "@/lib/whatsappTemplateVariables";

export default function WhatsAppTemplatePickerModal({
  isOpen,
  onClose,
  onConfirm,
  alreadyLinkedTemplates = [],
  title = "Select WhatsApp templates",
  description = "Choose approved templates from your connected WhatsApp account. Only selected templates are saved to this campaign.",
}) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [expandedKey, setExpandedKey] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const loadTemplates = useCallback(async (refresh = false) => {
    const isRefresh = refresh === true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const url = isRefresh
        ? "/api/integrations/whatsapp/templates?refresh=true"
        : "/api/integrations/whatsapp/templates?refresh=false";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load WhatsApp templates");
      }
      setTemplates(data.templates ?? []);
    } catch (err) {
      setLoadError(err.message);
      setTemplates([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedKeys(new Set());
      setExpandedKey(null);
      loadTemplates(false);
    }
  }, [isOpen, loadTemplates]);

  const availableTemplates = useMemo(
    () =>
      templates.filter(
        (t) => !isWhatsAppTemplateAlreadyLinked(t, alreadyLinkedTemplates)
      ),
    [templates, alreadyLinkedTemplates]
  );

  const toggleKey = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedTemplates = useMemo(
    () =>
      availableTemplates.filter((t) =>
        selectedKeys.has(whatsAppTemplateKey(t))
      ),
    [availableTemplates, selectedKeys]
  );

  const handleConfirm = () => {
    if (selectedTemplates.length === 0) {
      toast.error("Select at least one template.");
      return;
    }
    onConfirm?.(selectedTemplates);
    onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent mx={3} maxH="88vh" borderRadius="xl">
        <ModalHeader borderBottomWidth="1px" py={4} pr={12}>
          <p className="text-base font-semibold text-gray-900">{title}</p>
          <p className="text-xs font-normal text-gray-500 mt-0.5">{description}</p>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody py={4} px={{ base: 4, md: 5 }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs text-gray-500">
              {availableTemplates.length} available
              {alreadyLinkedTemplates.filter((t) => t.channel === "whatsapp")
                .length > 0
                ? ` · ${alreadyLinkedTemplates.filter((t) => t.channel === "whatsapp").length} already on campaign`
                : ""}
            </p>
            <button
              type="button"
              onClick={() => loadTemplates(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 disabled:opacity-50"
            >
              <HiOutlineArrowPath
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Loading templates…
            </p>
          ) : loadError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p>{loadError}</p>
              <p className="text-xs mt-2 text-amber-800">
                Connect WhatsApp in Settings, then refresh templates.
              </p>
            </div>
          ) : availableTemplates.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {templates.length === 0
                ? "No approved templates found. Refresh from your provider or connect WhatsApp in Settings."
                : "All available templates are already linked to this campaign."}
            </p>
          ) : (
            <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
              {availableTemplates.map((t) => {
                const key = whatsAppTemplateKey(t);
                const checked = selectedKeys.has(key);
                const expanded = expandedKey === key;
                return (
                  <li key={key} className="text-sm bg-white">
                    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/80">
                      <Checkbox
                        mt={0.5}
                        isChecked={checked}
                        onChange={() => toggleKey(key)}
                        colorScheme="blue"
                      />
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() =>
                            setExpandedKey(expanded ? null : key)
                          }
                        >
                          <p className="font-medium text-gray-900 truncate">
                            {t.displayName || t.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {t.name} · {t.language} · {t.status}
                            {t.category ? ` · ${t.category}` : ""}
                            {(() => {
                              const { bodyCount, headerCount } =
                                parseWhatsAppTemplateVariableSlots(t);
                              const total = bodyCount + headerCount;
                              return total > 0
                                ? ` · ${total} variable${total === 1 ? "" : "s"}`
                                : "";
                            })()}
                          </p>
                        </button>
                        {expanded && t.body ? (
                          <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed border-l-2 border-sky-200 pl-2">
                            {t.body}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ModalBody>

        <ModalFooter borderTopWidth="1px" gap={2}>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={handleConfirm}
            isDisabled={selectedTemplates.length === 0 || loading}
          >
            Add {selectedTemplates.length > 0 ? selectedTemplates.length : ""}{" "}
            template{selectedTemplates.length === 1 ? "" : "s"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

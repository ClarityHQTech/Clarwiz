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
} from "@chakra-ui/react";
import { useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { toast } from "sonner";
import TemplateEditorCard from "@/components/campaigns/TemplateEditorCard";
import {
  CAMPAIGN_CHANNELS,
  CHANNEL_LABELS,
  createTemplate,
  validateTemplate,
} from "@/lib/campaignConstants";

export default function CampaignTemplatesModal({
  isOpen,
  onClose,
  campaignId,
  templates = [],
  onUpdated,
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const startCreate = (channel) => {
    const existingStages = templates
      .filter((t) => t.channel === channel)
      .map((t) => t.stage);
    const nextStage =
      existingStages.length > 0 ? Math.max(...existingStages) + 1 : 1;
    setDraft(createTemplate(channel, nextStage));
    setCreating(true);
  };

  const resetDraft = () => {
    setDraft(null);
    setCreating(false);
  };

  const saveTemplate = async () => {
    const err = validateTemplate(draft);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: draft.channel,
          stage: draft.stage,
          subject: draft.subject,
          body: draft.body,
          cta: draft.cta,
          whatsappTemplateId: draft.whatsappTemplateId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");
      toast.success("Template added.");
      resetDraft();
      onUpdated?.(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    setDeletingId(templateId);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/templates?templateId=${templateId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Template removed.");
      onUpdated?.(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClose = () => {
    if (!saving && !deletingId) {
      resetDraft();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent mx={3} maxH="92vh" borderRadius="xl">
        <ModalHeader borderBottomWidth="1px" py={4} pr={12}>
          <p className="text-base font-semibold text-gray-900">
            Communication templates
          </p>
          <p className="text-xs font-normal text-gray-500 mt-0.5">
            View existing templates or create new ones with variable placeholders.
          </p>
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} />

        <ModalBody py={5} px={{ base: 4, md: 6 }} className="space-y-5">
          {CAMPAIGN_CHANNELS.map((channel) => {
            const channelTemplates = templates
              .filter((t) => t.channel === channel)
              .sort((a, b) => a.stage - b.stage);

            return (
              <div
                key={channel}
                className="rounded-lg border border-gray-200 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {CHANNEL_LABELS[channel]}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {channelTemplates.length} template
                      {channelTemplates.length === 1 ? "" : "s"}
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => startCreate(channel)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <HiOutlinePlus className="h-3.5 w-3.5" />
                    New template
                  </button>
                </div>

                <div className="p-4 space-y-3 bg-white">
                  {channelTemplates.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">
                      No templates for {CHANNEL_LABELS[channel]} yet.
                    </p>
                  ) : (
                    channelTemplates.map((t) => (
                      <div key={t.id} className="relative group">
                        <TemplateEditorCard template={t} readOnly />
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          onClick={() => deleteTemplate(t.id)}
                          className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete template"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {creating && draft && (
            <div className="rounded-lg border-2 border-sky-200 bg-sky-50/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">
                  New template — {CHANNEL_LABELS[draft.channel]}
                </h4>
                <button
                  type="button"
                  onClick={resetDraft}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
              <TemplateEditorCard
                template={draft}
                onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                showRemove={false}
              />
              <Button
                size="sm"
                colorScheme="blue"
                onClick={saveTemplate}
                isLoading={saving}
                loadingText="Saving…"
              >
                Save template
              </Button>
            </div>
          )}
        </ModalBody>

        <ModalFooter borderTopWidth="1px">
          <Button size="sm" variant="outline" onClick={handleClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

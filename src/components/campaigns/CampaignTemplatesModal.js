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
import { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { toast } from "sonner";
import TemplateEditorCard from "@/components/campaigns/TemplateEditorCard";
import WhatsAppCampaignTemplatesSection from "@/components/campaigns/WhatsAppCampaignTemplatesSection";
import {
  CAMPAIGN_CHANNELS,
  CHANNEL_LABELS,
  createTemplate,
  validateTemplate,
} from "@/lib/campaignConstants";
import { commTemplatesFromWhatsAppSelection } from "@/lib/whatsappCampaignTemplates";

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
  const [localTemplates, setLocalTemplates] = useState(templates);

  useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);

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

  const updateWhatsAppMapping = async (templateId, patch) => {
    const template = localTemplates.find((t) => t.id === templateId);
    if (!template) return;

    const next = { ...template, ...patch };
    setLocalTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? next : t))
    );

    const err = validateTemplate(next);
    if (err) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/templates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          whatsappVariableMapping: next.whatsappVariableMapping,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update mapping");
      onUpdated?.(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveWhatsAppTemplates = async (waTemplates) => {
    const rows = commTemplatesFromWhatsAppSelection(waTemplates, templates);
    if (rows.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: rows.map(
            ({ id, whatsappBodyVariableCount, whatsappHeaderVariableCount, ...rest }) =>
              rest
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save templates");
      toast.success(
        `Added ${rows.length} WhatsApp template${rows.length === 1 ? "" : "s"}.`
      );
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

  const nonWhatsAppChannels = CAMPAIGN_CHANNELS.filter((ch) => ch !== "whatsapp");

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent mx={3} maxH="92vh" borderRadius="xl" className="!bg-brand-surface">
        <ModalHeader borderBottomWidth="1px" py={4} pr={12} className="!bg-brand-surface">
          <p className="text-base font-semibold text-brand-ink">
            Communication templates
          </p>
          <p className="text-xs font-normal text-brand-stone mt-0.5">
            Select WhatsApp templates from your provider account, or create email and
            LinkedIn stage templates.
          </p>
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} />

        <ModalBody py={5} px={{ base: 4, md: 6 }} className="space-y-5 !bg-brand-surface">
          <WhatsAppCampaignTemplatesSection
            templates={localTemplates}
            onAddTemplates={saveWhatsAppTemplates}
            onUpdateTemplate={updateWhatsAppMapping}
            onRemove={(templateId) => deleteTemplate(templateId)}
          />

          {nonWhatsAppChannels.map((channel) => {
            const channelTemplates = templates
              .filter((t) => t.channel === channel)
              .sort((a, b) => a.stage - b.stage);

            return (
              <div
                key={channel}
                className="rounded-lg border border-brand-secondary/30 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-surface border-b border-brand-secondary/30">
                  <h4 className="text-sm font-semibold text-brand-ink">
                    {CHANNEL_LABELS[channel]}
                    <span className="ml-2 text-xs font-normal text-brand-stone">
                      {channelTemplates.length} template
                      {channelTemplates.length === 1 ? "" : "s"}
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => startCreate(channel)}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-secondary/40 bg-brand-surface px-2.5 py-1.5 text-xs font-medium text-brand-stone hover:bg-brand-bg"
                  >
                    <HiOutlinePlus className="h-3.5 w-3.5" />
                    New template
                  </button>
                </div>

                <div className="p-4 space-y-3 bg-brand-surface">
                  {channelTemplates.length === 0 ? (
                    <p className="text-xs text-brand-steel text-center py-2">
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
                          className="absolute top-3 right-3 p-1.5 rounded-md text-brand-steel hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
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

          {creating && draft && draft.channel !== "whatsapp" && (
            <div className="rounded-lg border-2 border-brand-sage/30 bg-brand-sage/15/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-brand-ink">
                  New template — {CHANNEL_LABELS[draft.channel]}
                </h4>
                <button
                  type="button"
                  onClick={resetDraft}
                  className="text-xs text-brand-stone hover:text-brand-stone"
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

        <ModalFooter borderTopWidth="1px" className="!bg-brand-surface">
          <Button size="sm" variant="outline" onClick={handleClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

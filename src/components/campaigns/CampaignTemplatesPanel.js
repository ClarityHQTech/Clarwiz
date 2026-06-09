"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ChannelTemplatesSection from "@/components/campaigns/ChannelTemplatesSection";
import WhatsAppCampaignTemplatesSection from "@/components/campaigns/WhatsAppCampaignTemplatesSection";
import {
  CAMPAIGN_CHANNELS,
  validateTemplate,
} from "@/lib/campaignConstants";
import { commTemplatesFromWhatsAppSelection } from "@/lib/whatsappCampaignTemplates";
import { TEMPLATE_VARIABLES } from "@/lib/templateVariables";

export default function CampaignTemplatesPanel({
  campaignId,
  templates = [],
  onUpdated,
}) {
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [localTemplates, setLocalTemplates] = useState(templates);

  useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);

  const saveChannelTemplate = async (template) => {
    const err = validateTemplate(template);
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
          channel: template.channel,
          stage: template.stage,
          subject: template.subject,
          body: template.body,
          cta: template.cta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");
      toast.success("Template added.");
      onUpdated?.(data);
    } catch (e) {
      toast.error(e.message);
      throw e;
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

  const nonWhatsAppChannels = CAMPAIGN_CHANNELS.filter((ch) => ch !== "whatsapp");

  return (
    <div className="space-y-5">
      <p className="text-xs text-brand-stone">
        Select WhatsApp templates from your provider account, or create email and
        LinkedIn stage templates ({TEMPLATE_VARIABLES}).
      </p>

      <WhatsAppCampaignTemplatesSection
        templates={localTemplates}
        onAddTemplates={saveWhatsAppTemplates}
        onUpdateTemplate={updateWhatsAppMapping}
        onRemove={(templateId) => deleteTemplate(templateId)}
      />

      {nonWhatsAppChannels.map((channel) => (
        <ChannelTemplatesSection
          key={channel}
          channel={channel}
          templates={localTemplates}
          onSaveTemplate={saveChannelTemplate}
          onRemove={(templateId) => deleteTemplate(templateId)}
          allowEdit={false}
          saving={saving || Boolean(deletingId)}
        />
      ))}
    </div>
  );
}

"use client";

import { useDisclosure } from "@chakra-ui/react";
import { useState } from "react";
import { HiOutlinePencil, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import TemplateEditorCard from "@/components/campaigns/TemplateEditorCard";
import TemplateEditorModal from "@/components/campaigns/TemplateEditorModal";
import {
  CHANNEL_LABELS,
  MAX_TEMPLATE_STAGE,
  createTemplate,
} from "@/lib/campaignConstants";
import { ui } from "@/lib/brandUi";

export default function ChannelTemplatesSection({
  channel,
  templates,
  onSaveTemplate,
  onRemove,
  readOnly = false,
  allowEdit = true,
  saving = false,
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [draft, setDraft] = useState(null);
  const [mode, setMode] = useState("create");

  const channelTemplates = templates
    .filter((t) => t.channel === channel)
    .sort((a, b) => a.stage - b.stage);

  const openCreate = () => {
    const existingStages = templates
      .filter((t) => t.channel === channel)
      .map((t) => t.stage);
    const nextStage =
      existingStages.length > 0 ? Math.max(...existingStages) + 1 : 1;
    setDraft(createTemplate(channel, Math.min(nextStage, MAX_TEMPLATE_STAGE)));
    setMode("create");
    onOpen();
  };

  const openEdit = (template) => {
    setDraft({ ...template });
    setMode("edit");
    onOpen();
  };

  const handleClose = () => {
    if (!saving) {
      setDraft(null);
      onClose();
    }
  };

  const handleSave = async (template) => {
    await onSaveTemplate?.(template, mode);
    setDraft(null);
    onClose();
  };

  return (
    <>
      <div className="rounded-lg border border-brand-secondary/30 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-bg border-b border-brand-secondary/30">
          <div>
            <h4 className="text-sm font-semibold text-brand-ink">
              {CHANNEL_LABELS[channel]}
            </h4>
            <p className="text-xs text-brand-stone mt-0.5">
              {channelTemplates.length} template
              {channelTemplates.length === 1 ? "" : "s"}
              {readOnly ? "" : " — add stage templates (optional)."}
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreate}
              className={`inline-flex items-center gap-1 ${ui.btnSecondarySurface} text-xs shrink-0`}
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              Add template
            </button>
          )}
        </div>

        <div className="p-4 space-y-3 bg-brand-bg/30">
          {channelTemplates.length === 0 ? (
            <p className="text-xs text-brand-steel text-center py-2">
              No templates for {CHANNEL_LABELS[channel]} — skip or add when ready.
            </p>
          ) : (
            channelTemplates.map((t) => (
              <div key={t.id} className="relative group">
                <TemplateEditorCard template={t} readOnly />
                {!readOnly && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {allowEdit && (
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="p-1.5 rounded-md text-brand-steel hover:text-brand-ink hover:bg-brand-bg"
                        aria-label="Edit template"
                      >
                        <HiOutlinePencil className="h-4 w-4" />
                      </button>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(t.id)}
                        className="p-1.5 rounded-md text-brand-steel hover:text-red-600 hover:bg-red-50"
                        aria-label="Remove template"
                      >
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <TemplateEditorModal
        isOpen={isOpen}
        onClose={handleClose}
        template={draft}
        onSave={handleSave}
        saving={saving}
        mode={mode}
      />
    </>
  );
}

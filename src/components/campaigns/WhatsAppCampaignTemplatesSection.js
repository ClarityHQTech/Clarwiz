"use client";

import { useDisclosure } from "@chakra-ui/react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import WhatsAppTemplatePickerModal from "@/components/campaigns/WhatsAppTemplatePickerModal";
import WhatsAppTemplateVariableMapping from "@/components/campaigns/WhatsAppTemplateVariableMapping";

export default function WhatsAppCampaignTemplatesSection({
  templates,
  onAddTemplates,
  onUpdateTemplate,
  onRemove,
  readOnly = false,
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const channelTemplates = templates
    .filter((t) => t.channel === "whatsapp")
    .sort((a, b) => a.stage - b.stage);

  const handleConfirm = (waTemplates) => {
    onAddTemplates?.(waTemplates);
  };

  return (
    <>
      <div className="rounded-lg border border-brand-secondary/30 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-bg border-b border-brand-secondary/30">
          <div>
            <h4 className="text-sm font-semibold text-brand-ink">
              {CHANNEL_LABELS.whatsapp}
            </h4>
            <p className="text-xs text-brand-stone mt-0.5">
              Select approved templates from your connected WhatsApp account.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-secondary/40 bg-brand-surface px-2.5 py-1.5 text-xs font-medium text-brand-stone hover:bg-brand-bg shrink-0"
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              Select templates
            </button>
          )}
        </div>

        <div className="p-4 space-y-3 bg-brand-bg/30">
          {channelTemplates.length === 0 ? (
            <p className="text-xs text-brand-steel text-center py-2">
              No WhatsApp templates selected — skip or choose templates to use in
              outreach.
            </p>
          ) : (
            channelTemplates.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-brand-secondary/30 bg-brand-surface p-3 text-sm relative group"
              >
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-brand-ink">
                      {t.whatsappTemplateId}
                      <span className="ml-2 text-xs font-normal text-brand-stone">
                        Stage {t.stage}
                      </span>
                    </p>
                    {t.body && (
                      <p className="text-xs text-brand-stone mt-1 whitespace-pre-wrap line-clamp-3 border-l-2 border-brand-sage/40 pl-2">
                        {t.body}
                      </p>
                    )}
                    <WhatsAppTemplateVariableMapping
                      template={t}
                      readOnly={readOnly}
                      onChange={(patch) => onUpdateTemplate?.(t.id, patch)}
                    />
                  </div>
                  {!readOnly && onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(t.id)}
                      className="p-1.5 rounded-md text-brand-steel hover:text-red-600 hover:bg-red-50 shrink-0"
                      aria-label="Remove template"
                    >
                      <HiOutlineTrash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <WhatsAppTemplatePickerModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleConfirm}
        alreadyLinkedTemplates={templates}
      />
    </>
  );
}

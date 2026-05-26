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
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              {CHANNEL_LABELS.whatsapp}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Select approved templates from your connected WhatsApp account.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shrink-0"
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              Select templates
            </button>
          )}
        </div>

        <div className="p-4 space-y-3 bg-gray-50/30">
          {channelTemplates.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">
              No WhatsApp templates selected — skip or choose templates to use in
              outreach.
            </p>
          ) : (
            channelTemplates.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-gray-200 bg-white p-3 text-sm relative group"
              >
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">
                      {t.whatsappTemplateId}
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        Stage {t.stage}
                      </span>
                    </p>
                    {t.body && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3 border-l-2 border-emerald-200 pl-2">
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
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
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

"use client";

import { Select } from "@chakra-ui/react";
import { HiOutlineTrash } from "react-icons/hi2";
import VariableTextField from "@/components/campaigns/VariableTextField";
import {
  CHANNEL_LABELS,
  CTA_OPTIONS,
  MAX_TEMPLATE_STAGE,
} from "@/lib/campaignConstants";

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-brand-stone mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-brand-steel mt-1">{hint}</p>}
    </div>
  );
}

export default function TemplateEditorCard({
  template,
  onChange,
  onRemove,
  showRemove = true,
  readOnly = false,
}) {
  const { channel } = template;

  if (readOnly) {
    return (
      <div className="rounded-lg border border-brand-secondary/30 bg-brand-bg/50 p-4 space-y-2 text-sm">
        <div className="flex justify-between items-start">
          <span className="font-medium text-brand-ink">
            {CHANNEL_LABELS[channel]} · Stage {template.stage}
          </span>
        </div>
        {template.subject && (
          <p className="text-xs text-brand-stone">
            <span className="font-medium">Subject:</span> {template.subject}
          </p>
        )}
        {template.whatsappTemplateId && (
          <p className="text-xs text-brand-stone">
            <span className="font-medium">WA ID:</span> {template.whatsappTemplateId}
          </p>
        )}
        <p className="text-xs text-brand-stone whitespace-pre-wrap border-l-2 border-brand-sage/30 pl-2">
          {template.body}
        </p>
        <p className="text-xs text-brand-steel">
          CTA: {CTA_OPTIONS.find((c) => c.value === template.cta)?.label}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-secondary/30 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Field label="Stage">
            <Select
              size="sm"
              w="28"
              value={template.stage}
              onChange={(e) => onChange({ stage: Number(e.target.value) })}
            >
              {Array.from({ length: MAX_TEMPLATE_STAGE }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    Stage {n}
                  </option>
                )
              )}
            </Select>
          </Field>
          <span className="text-xs font-medium text-brand-stone mt-5">
            {CHANNEL_LABELS[channel]}
          </span>
        </div>
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-brand-steel hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
            aria-label="Remove template"
          >
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        )}
      </div>

      {channel === "email" && (
        <VariableTextField
          label="Subject"
          required
          value={template.subject ?? ""}
          onChange={(v) => onChange({ subject: v })}
          placeholder="Quick idea for {{company}}"
        />
      )}

      <VariableTextField
        label={
          channel === "whatsapp" ? "Template message preview" : "Message body"
        }
        required
        multiline
        rows={4}
        value={template.body ?? ""}
        onChange={(v) => onChange({ body: v })}
        placeholder={
          channel === "whatsapp"
            ? "Body text matching your approved WhatsApp template..."
            : "Hi {{first_name}}, I noticed {{company}}..."
        }
      />

      <Field label="CTA" required>
        <Select
          size="sm"
          value={template.cta}
          onChange={(e) => onChange({ cta: e.target.value })}
        >
          {CTA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

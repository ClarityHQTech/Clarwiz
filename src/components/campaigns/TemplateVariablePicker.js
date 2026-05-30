"use client";

import { TEMPLATE_VARIABLE_LIST } from "@/lib/templateVariables";

export default function TemplateVariablePicker({ onInsert }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-brand-stone">
        Click or drag variables into the field below
      </p>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_VARIABLE_LIST.map(({ token, label }) => (
          <button
            key={token}
            type="button"
            draggable
            onClick={() => onInsert(token)}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", token);
              e.dataTransfer.effectAllowed = "copy";
            }}
            title={label}
            className="cursor-grab active:cursor-grabbing rounded-md border border-brand-secondary/30 bg-brand-bg px-2 py-1 text-xs font-mono text-brand-ink hover:bg-brand-sage/15 hover:border-brand-sage/30 transition-colors"
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

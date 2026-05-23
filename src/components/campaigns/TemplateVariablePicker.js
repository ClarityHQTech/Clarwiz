"use client";

import { TEMPLATE_VARIABLE_LIST } from "@/lib/templateVariables";

export default function TemplateVariablePicker({ onInsert }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500">
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
            className="cursor-grab active:cursor-grabbing rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-mono text-sky-800 hover:bg-sky-50 hover:border-sky-200 transition-colors"
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

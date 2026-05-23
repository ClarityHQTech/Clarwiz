"use client";

import { Input, Textarea } from "@chakra-ui/react";
import { useRef } from "react";
import TemplateVariablePicker from "@/components/campaigns/TemplateVariablePicker";
import {
  insertVariableIntoField,
  restoreInputCursor,
} from "@/lib/templateVariables";

function FieldShell({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function VariableTextField({
  label,
  required,
  hint,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  showVariables = true,
}) {
  const inputRef = useRef(null);

  const insertToken = (token) => {
    const { value: next, cursor } = insertVariableIntoField(
      value ?? "",
      token,
      inputRef
    );
    onChange(next);
    restoreInputCursor(inputRef, cursor);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const token = e.dataTransfer.getData("text/plain");
    if (!token) return;
    insertToken(token);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const sharedProps = {
    ref: inputRef,
    size: "sm",
    value: value ?? "",
    onChange: (e) => onChange(e.target.value),
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    placeholder,
  };

  return (
    <FieldShell label={label} required={required} hint={hint}>
      {showVariables && (
        <div className="mb-2">
          <TemplateVariablePicker onInsert={insertToken} />
        </div>
      )}
      {multiline ? (
        <Textarea rows={rows} {...sharedProps} />
      ) : (
        <Input {...sharedProps} />
      )}
    </FieldShell>
  );
}

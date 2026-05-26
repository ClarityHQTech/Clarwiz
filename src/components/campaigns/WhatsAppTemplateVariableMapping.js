"use client";

import { useEffect, useState } from "react";
import { Input, Select } from "@chakra-ui/react";
import {
  WHATSAPP_CAMPAIGN_VARIABLES,
  WHATSAPP_CUSTOM_TEXT_TOKENS,
  WHATSAPP_MAPPING_CUSTOM_OPTION,
  countWhatsAppNumberedVariables,
  encodeCustomMapping,
  getCustomMappingText,
  isCustomMappingValue,
  mappingSelectValue,
} from "@/lib/whatsappTemplateVariables";

function SlotRow({ slotIndex, value, onChange, disabled }) {
  const selectValue = mappingSelectValue(value);
  const [showCustom, setShowCustom] = useState(
    selectValue === WHATSAPP_MAPPING_CUSTOM_OPTION
  );

  useEffect(() => {
    setShowCustom(mappingSelectValue(value) === WHATSAPP_MAPPING_CUSTOM_OPTION);
  }, [value]);

  const isCustom = showCustom || isCustomMappingValue(value);
  const customText = isCustomMappingValue(value) ? getCustomMappingText(value) : "";

  const handleSelectChange = (next) => {
    if (next === WHATSAPP_MAPPING_CUSTOM_OPTION) {
      setShowCustom(true);
      if (!isCustomMappingValue(value)) {
        onChange(encodeCustomMapping(""));
      }
      return;
    }
    setShowCustom(false);
    onChange(next);
  };

  return (
    <div className="rounded-md border border-gray-100 bg-gray-50/50 p-3 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-gray-600 w-10 shrink-0">{`{{${slotIndex}}}`}</span>
        <span className="text-gray-400">→</span>
        <Select
          size="sm"
          flex="1"
          minW="140px"
          maxW="200px"
          value={isCustom ? WHATSAPP_MAPPING_CUSTOM_OPTION : selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          isDisabled={disabled}
          placeholder="Select field"
        >
          {WHATSAPP_CAMPAIGN_VARIABLES.map((v) => (
            <option key={v.key} value={v.key}>
              {v.label}
            </option>
          ))}
          <option value={WHATSAPP_MAPPING_CUSTOM_OPTION}>Custom text…</option>
        </Select>
      </div>
      {isCustom && (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-600">
            Custom value for {"{{"}
            {slotIndex}
            {"}}"}
          </label>
          <Input
            size="sm"
            w="100%"
            value={customText}
            onChange={(e) => onChange(encodeCustomMapping(e.target.value))}
            isDisabled={disabled}
            placeholder="https://yoursite.com/?id={{prospect_id}}"
            fontFamily="mono"
            fontSize="xs"
            bg="white"
            autoFocus
          />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Type fixed text and insert tokens: {WHATSAPP_CUSTOM_TEXT_TOKENS.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppTemplateVariableMapping({
  template,
  onChange,
  readOnly = false,
}) {
  const bodyCount =
    template.whatsappBodyVariableCount ??
    countWhatsAppNumberedVariables(template.body);
  const headerCount = Math.max(
    template.whatsappHeaderVariableCount ?? 0,
    template.whatsappVariableMapping?.header?.length ?? 0
  );

  const mapping = template.whatsappVariableMapping ?? { body: [], header: [] };

  if (bodyCount === 0 && headerCount === 0) {
    return (
      <p className="text-xs text-gray-500 mt-2">
        No dynamic variables in this template — sends as-is.
      </p>
    );
  }

  const updateMapping = (patch) => {
    onChange?.({
      whatsappVariableMapping: {
        body: mapping.body ?? [],
        header: mapping.header ?? [],
        ...patch,
      },
    });
  };

  const setBodySlot = (index, key) => {
    const body = [...(mapping.body ?? [])];
    while (body.length < bodyCount) body.push("");
    body[index] = key;
    updateMapping({ body });
  };

  const setHeaderSlot = (index, key) => {
    const header = [...(mapping.header ?? [])];
    while (header.length < headerCount) header.push("");
    header[index] = key;
    updateMapping({ header });
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <p className="text-xs font-medium text-gray-700">Variable mapping</p>
      <p className="text-xs text-gray-500">
        Map each WhatsApp placeholder to a prospect field or custom fixed text
        (with tokens like {"{{prospect_id}}"}).
      </p>
      {bodyCount > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Body
          </p>
          {Array.from({ length: bodyCount }, (_, i) => (
            <SlotRow
              key={`body-${i}`}
              slotIndex={i + 1}
              value={mapping.body?.[i]}
              onChange={(key) => setBodySlot(i, key)}
              disabled={readOnly}
            />
          ))}
        </div>
      )}
      {headerCount > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Header
          </p>
          {Array.from({ length: headerCount }, (_, i) => (
            <SlotRow
              key={`header-${i}`}
              slotIndex={i + 1}
              value={mapping.header?.[i]}
              onChange={(key) => setHeaderSlot(i, key)}
              disabled={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

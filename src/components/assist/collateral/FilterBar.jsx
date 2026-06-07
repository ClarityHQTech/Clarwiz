"use client";

import {
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FiSearch } from "react-icons/fi";
import { TYPE_OPTIONS, STAGE_OPTIONS } from "./constants";

/**
 * Search + type/stage/tag filters for the collateral grid. Controlled by the
 * parent (CollateralClient) — purely presentational.
 */
export default function FilterBar({ filters, onChange, tagOptions = [] }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <Wrap spacing={3} align="center" mb={4}>
      <WrapItem flex="1" minW="220px">
        <InputGroup>
          <InputLeftElement pointerEvents="none" color="gray.400">
            <FiSearch />
          </InputLeftElement>
          <Input
            bg="white"
            placeholder="Search title or tag…"
            value={filters.q}
            onChange={set("q")}
          />
        </InputGroup>
      </WrapItem>
      <WrapItem>
        <Select bg="white" w="180px" value={filters.type} onChange={set("type")}>
          <option value="">All types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </WrapItem>
      <WrapItem>
        <Select bg="white" w="160px" value={filters.funnelStage} onChange={set("funnelStage")}>
          <option value="">All stages</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </WrapItem>
      {tagOptions.length > 0 && (
        <WrapItem>
          <Select bg="white" w="160px" value={filters.tag} onChange={set("tag")}>
            <option value="">All tags</option>
            {tagOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </WrapItem>
      )}
    </Wrap>
  );
}

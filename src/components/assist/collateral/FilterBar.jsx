"use client";

import { TYPE_OPTIONS, STAGE_OPTIONS } from "./constants";
import { ui } from "@/lib/brandUi";

export default function FilterBar({ filters, onChange, tagOptions = [] }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <input
        className={`${ui.inputSurface} flex-1 min-w-[200px]`}
        placeholder="Search title or tag…"
        value={filters.q}
        onChange={set("q")}
      />
      <select className={`${ui.inputSurface} w-full sm:w-40`} value={filters.type} onChange={set("type")}>
        <option value="">All types</option>
        {TYPE_OPTIONS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select className={`${ui.inputSurface} w-full sm:w-36`} value={filters.funnelStage} onChange={set("funnelStage")}>
        <option value="">All stages</option>
        {STAGE_OPTIONS.map((stg) => (
          <option key={stg.value} value={stg.value}>
            {stg.label}
          </option>
        ))}
      </select>
      {tagOptions.length > 0 ? (
        <select className={`${ui.inputSurface} w-full sm:w-36`} value={filters.tag} onChange={set("tag")}>
          <option value="">All tags</option>
          {tagOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

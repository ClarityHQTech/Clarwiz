"use client";

import { TYPE_OPTIONS, STAGE_OPTIONS } from "./constants";

/**
 * Search + type/stage/tag filters for the collateral grid (cockpit). Controlled
 * by the parent (CollateralClient) — purely presentational.
 */
export default function FilterBar({ filters, onChange, tagOptions = [] }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
      <input
        className="ck-input"
        style={{ flex: 1, minWidth: 220 }}
        placeholder="Search title or tag…"
        value={filters.q}
        onChange={set("q")}
      />
      <select className="ck-input" style={{ width: 170 }} value={filters.type} onChange={set("type")}>
        <option value="">All types</option>
        {TYPE_OPTIONS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select className="ck-input" style={{ width: 160 }} value={filters.funnelStage} onChange={set("funnelStage")}>
        <option value="">All stages</option>
        {STAGE_OPTIONS.map((stg) => (
          <option key={stg.value} value={stg.value}>
            {stg.label}
          </option>
        ))}
      </select>
      {tagOptions.length > 0 && (
        <select className="ck-input" style={{ width: 160 }} value={filters.tag} onChange={set("tag")}>
          <option value="">All tags</option>
          {tagOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

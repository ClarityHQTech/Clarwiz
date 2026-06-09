"use client";

import { ui } from "@/lib/brandUi";

export function SectionTitle({ children }) {
  return <h3 className={`${ui.label} mb-2 mt-4 first:mt-0 normal-case tracking-wide`}>{children}</h3>;
}

export function InsightRow({ name, badge, children }) {
  return (
    <div className="px-4 py-3 border-b border-brand-secondary/15 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-brand-ink">{name}</p>
        {badge}
      </div>
      {children ? <p className="text-sm text-brand-stone mt-1">{children}</p> : null}
    </div>
  );
}

export function KvGrid({ items }) {
  const rows = (items || []).filter((i) => i && i.value != null && i.value !== "");
  if (!rows.length) return null;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((i, idx) => (
        <div key={idx} className={ui.miniStat}>
          <p className="text-xs text-brand-stone">{i.label}</p>
          <p className="text-sm font-semibold text-brand-ink mt-0.5">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

export function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export function BriefingBlock({ label, children, className = "" }) {
  return (
    <div className={`rounded-lg border border-brand-sage/30 bg-brand-sage/10 px-4 py-3 ${className}`}>
      {label ? <p className={`${ui.label} mb-2 normal-case tracking-wide`}>{label}</p> : null}
      <div className="text-sm text-brand-ink leading-relaxed">{children}</div>
    </div>
  );
}

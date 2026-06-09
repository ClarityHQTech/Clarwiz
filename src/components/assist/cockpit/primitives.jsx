"use client";

import { scoreVar } from "./format";

/** Mono uppercase badge. variant: ok|warn|danger|info|accent|ghost. */
export function CkBadge({ variant = "ghost", children }) {
  return <span className={`ck-badge ck-badge-${variant}`}>{children}</span>;
}

/**
 * Circular score gauge (matches the mockup's score-ring). 0-100, color banded.
 * size default 56px. `label` rendered beneath.
 */
export function ScoreRing({ score, label, size = 56 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const offset = c * (1 - pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div className="ck-score-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className="ck-score-ring-bg" cx={size / 2} cy={size / 2} r={r} />
          <circle
            className="ck-score-ring-fg"
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={scoreVar(score)}
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="ck-score-ring-text">{score == null ? "—" : score}</div>
      </div>
      {label && <div className="ck-score-ring-label">{label}</div>}
    </div>
  );
}

/** Panel card with mono header + optional action. */
export function CkCard({ title, count, action, children, className = "", style }) {
  return (
    <div className={`ck-card ${className}`} style={style}>
      {(title || action) && (
        <div className="ck-card-header">
          <div className="ck-card-title">
            {title}
            {count != null && <span className="ck-card-title-count">{count}</span>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Section divider title used inside the company drawer. */
export function SectionTitle({ children }) {
  return <div className="ck-section-title">{children}</div>;
}

/** A risk/insight row: bold name + badge + description. */
export function InsightRow({ name, badge, children }) {
  return (
    <div className="ck-risk-card">
      <div className="ck-risk-card-header">
        <div className="ck-risk-name">{name}</div>
        {badge}
      </div>
      {children && <div className="ck-risk-desc">{children}</div>}
    </div>
  );
}

/** Key/value tile grid. items: [{label, value}]. */
export function KvGrid({ items }) {
  const rows = (items || []).filter((i) => i && i.value != null && i.value !== "");
  if (!rows.length) return null;
  return (
    <div className="ck-kv-grid">
      {rows.map((i, idx) => (
        <div className="ck-kv" key={idx}>
          <div className="ck-kv-label">{i.label}</div>
          <div className="ck-kv-value">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Initials from a name for avatars. */
export function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

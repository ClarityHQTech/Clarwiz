"use client";

import { CkBadge } from "../cockpit/primitives";
import { TYPE_LABELS, STAGE_LABELS, SOURCE_LABELS, CATEGORY_LABELS, CATEGORY_COLORS } from "./constants";

const TYPE_STYLE = {
  CASE_STUDY: { letter: "C", variant: "accent", color: "var(--accent)", grad: "rgba(242,166,90,0.15)" },
  BATTLECARD: { letter: "B", variant: "ok", color: "var(--ok)", grad: "rgba(127,212,156,0.15)" },
  PITCH_DECK: { letter: "D", variant: "info", color: "var(--info)", grad: "rgba(138,180,248,0.15)" },
  ONE_PAGER: { letter: "O", variant: "danger", color: "var(--danger)", grad: "rgba(229,115,111,0.12)" },
  EMAIL_TEMPLATE: { letter: "E", variant: "info", color: "var(--info)", grad: "rgba(138,180,248,0.15)" },
  MARKETING_DOC: { letter: "M", variant: "warn", color: "var(--warn)", grad: "rgba(242,201,76,0.12)" },
  OTHER: { letter: "·", variant: "ghost", color: "var(--text-2)", grad: "rgba(255,255,255,0.05)" },
};

/**
 * One template tile (cockpit). Type-badge thumbnail with a colored gradient,
 * a Marketing/Sales category badge and a "Template" badge, title, meta, and
 * Open actions. Any row backed by a Document (externalId set) — generated or an
 * uploaded brand template — opens the live editor; link-only rows open the
 * redirect route.
 */
export default function CollateralTile({ item, onOpenEditor }) {
  const style = TYPE_STYLE[item.type] || TYPE_STYLE.OTHER;
  const documentId = item.externalId;
  const isEditable = Boolean(documentId);

  const open = () => {
    if (isEditable && documentId) onOpenEditor?.(documentId, item);
  };

  return (
    <div className="ck-collateral-tile">
      <div className="ck-collateral-thumb">
        <div
          className="ck-collateral-thumb-grad"
          style={{ background: `linear-gradient(135deg, ${style.grad}, transparent 60%)` }}
        />
        <div className="ck-collateral-thumb-icon" style={{ color: style.color }}>
          {style.letter}
        </div>
        <div className="ck-collateral-type-badge">
          <CkBadge variant={style.variant}>{TYPE_LABELS[item.type] ?? item.type}</CkBadge>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 6px" }}>
        {item.category ? (
          <CkBadge variant={CATEGORY_COLORS[item.category] ?? "ghost"}>
            {CATEGORY_LABELS[item.category] ?? item.category}
          </CkBadge>
        ) : null}
        {item.isTemplate ? <CkBadge variant="ghost">Template</CkBadge> : null}
      </div>

      <div className="ck-collateral-title">{item.title}</div>
      <div className="ck-collateral-meta">
        <span>{SOURCE_LABELS[item.source] ?? item.source}</span>
        <span>·</span>
        <span>{STAGE_LABELS[item.funnelStage] ?? item.funnelStage}</span>
        {item.tags?.length ? (
          <>
            <span>·</span>
            <span>{item.tags.length} tag{item.tags.length === 1 ? "" : "s"}</span>
          </>
        ) : null}
      </div>

      <div className="ck-collateral-actions">
        {isEditable ? (
          <button type="button" className="ck-btn ck-btn-primary" onClick={open} style={{ fontSize: 11, padding: "6px 12px" }}>
            Open in editor →
          </button>
        ) : (
          <a
            href={`/api/assist/collateral/${item.id}/open`}
            target="_blank"
            rel="noopener noreferrer"
            className="ck-btn ck-btn-ghost"
            style={{ fontSize: 11, padding: "6px 12px" }}
          >
            Open ↗
          </a>
        )}
      </div>
    </div>
  );
}

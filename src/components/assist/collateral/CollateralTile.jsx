"use client";

import AssistBadge from "../ui/AssistBadge";
import { TYPE_LABELS, STAGE_LABELS, SOURCE_LABELS, CATEGORY_LABELS, CATEGORY_COLORS } from "./constants";
import { ui } from "@/lib/brandUi";

const TYPE_ACCENT = {
  CASE_STUDY: "bg-brand-terracotta/15 text-brand-terracotta",
  BATTLECARD: "bg-brand-sage/20 text-brand-ink",
  PITCH_DECK: "bg-brand-terracotta/10 text-brand-ink",
  ONE_PAGER: "bg-red-50 text-red-800",
  EMAIL_TEMPLATE: "bg-brand-gold/15 text-brand-ink",
  MARKETING_DOC: "bg-brand-gold/20 text-brand-ink",
  OTHER: "bg-brand-bg text-brand-stone",
};

const TYPE_LETTER = {
  CASE_STUDY: "C",
  BATTLECARD: "B",
  PITCH_DECK: "D",
  ONE_PAGER: "O",
  EMAIL_TEMPLATE: "E",
  MARKETING_DOC: "M",
  OTHER: "·",
};

export default function CollateralTile({ item, onOpenEditor }) {
  const documentId = item.externalId;
  const isEditable = Boolean(documentId);
  const thumbClass = TYPE_ACCENT[item.type] || TYPE_ACCENT.OTHER;
  const letter = TYPE_LETTER[item.type] || TYPE_LETTER.OTHER;

  const open = () => {
    if (isEditable && documentId) onOpenEditor?.(documentId, item);
  };

  return (
    <article className={`${ui.cardSurface} overflow-hidden flex flex-col`}>
      <div className={`relative h-28 flex items-center justify-center ${thumbClass}`}>
        <span className="text-3xl font-serif font-semibold opacity-80">{letter}</span>
        <div className="absolute top-2 right-2">
          <AssistBadge variant="ghost">{TYPE_LABELS[item.type] ?? item.type}</AssistBadge>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {item.category ? (
            <AssistBadge variant={CATEGORY_COLORS[item.category] ?? "ghost"}>
              {CATEGORY_LABELS[item.category] ?? item.category}
            </AssistBadge>
          ) : null}
          {item.isTemplate ? <AssistBadge variant="ghost">Template</AssistBadge> : null}
        </div>

        <h3 className="text-sm font-medium text-brand-ink line-clamp-2">{item.title}</h3>
        <p className="text-xs text-brand-stone mt-1">
          {SOURCE_LABELS[item.source] ?? item.source} · {STAGE_LABELS[item.funnelStage] ?? item.funnelStage}
          {item.tags?.length ? ` · ${item.tags.length} tag${item.tags.length === 1 ? "" : "s"}` : ""}
        </p>

        <div className="mt-auto pt-4">
          {isEditable ? (
            <button type="button" className={`${ui.btnPrimary} w-full text-xs`} onClick={open}>
              Open in editor
            </button>
          ) : (
            <a
              href={`/api/assist/collateral/${item.id}/open`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ui.btnSecondarySurface} w-full text-xs text-center`}
            >
              Open
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

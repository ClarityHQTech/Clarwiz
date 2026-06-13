"use client";

import { useEffect, useMemo, useState } from "react";
import { HiOutlineDocumentText } from "react-icons/hi2";
import AssistBadge from "../ui/AssistBadge";
import CollateralViewerModal from "./CollateralViewerModal";
import { TYPE_LABELS, SOURCE_LABELS } from "./constants";
import { ui } from "@/lib/brandUi";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CreatedCollateralSection({ items: initialItems = [], onEdit }) {
  const [items, setItems] = useState(initialItems);
  const [viewer, setViewer] = useState(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = [
        it.title,
        it.dealName,
        it.companyName,
        it.dealStage,
        TYPE_LABELS[it.type],
        SOURCE_LABELS[it.source],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const openViewer = (item) => {
    if (!item.externalId) return;
    setViewer(item);
  };

  const handleEdit = (item) => {
    setViewer(null);
    onEdit?.(item);
  };

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className={ui.titleSm}>Created collateral</h2>
          <p className={`${ui.body} text-sm mt-1`}>
            All collateral created for deals and prospects — from manual creation, NBA, and other flows.
          </p>
        </div>
        {items.length > 0 ? (
          <input
            type="search"
            className={`${ui.input} sm:max-w-xs`}
            placeholder="Search by title, deal, company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className={`${ui.cardSurface} p-8 text-center`}>
          <HiOutlineDocumentText className="h-10 w-10 mx-auto text-brand-stone/50 mb-3" />
          <p className={ui.body}>No collateral created yet.</p>
          <p className="text-sm text-brand-stone mt-1">
            Use Create collateral to generate one, or let NBA create it when executing on a deal.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${ui.cardSurface} p-6 text-center`}>
          <p className={ui.body}>No matches for your search.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openViewer(item)}
              disabled={!item.externalId}
              className={`${ui.cardSurface} w-full text-left p-4 transition hover:border-brand-terracotta/40 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <AssistBadge variant="ghost">{TYPE_LABELS[item.type] ?? item.type}</AssistBadge>
                    <AssistBadge variant="ghost">{SOURCE_LABELS[item.source] ?? item.source}</AssistBadge>
                  </div>
                  <h3 className="text-sm font-medium text-brand-ink line-clamp-2">{item.title}</h3>
                  <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-brand-stone">
                    <div>
                      <dt className="inline font-semibold text-brand-stone/80">Deal: </dt>
                      <dd className="inline text-brand-ink">{item.dealName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-brand-stone/80">Company: </dt>
                      <dd className="inline text-brand-ink">{item.companyName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-brand-stone/80">Created: </dt>
                      <dd className="inline text-brand-ink">{formatDate(item.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
                <span className={`${ui.btnSecondarySurface} shrink-0 text-xs pointer-events-none`}>
                  View
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewer ? (
        <CollateralViewerModal item={viewer} onClose={() => setViewer(null)} onEdit={onEdit ? handleEdit : null} />
      ) : null}
    </section>
  );
}

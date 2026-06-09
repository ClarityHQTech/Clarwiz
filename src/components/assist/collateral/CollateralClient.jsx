"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlinePlus } from "react-icons/hi2";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FilterBar from "./FilterBar";
import CollateralTile from "./CollateralTile";
import CollateralEditorModal from "./CollateralEditorModal";
import RegisterModal from "./RegisterModal";
import { ui } from "@/lib/brandUi";

const INITIAL_FILTERS = { q: "", type: "", funnelStage: "", tag: "" };

function CollateralClient({ items: initialItems }) {
  const [items, setItems] = useState(initialItems ?? []);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const open = new URLSearchParams(window.location.search).get("open");
    if (!open) return;
    setEditor((prev) => {
      if (prev) return prev;
      const match = (initialItems ?? []).find((it) => it.externalId === open);
      return { documentId: open, title: match?.title };
    });
  }, [initialItems]);

  const tagOptions = useMemo(() => {
    const set = new Set();
    items.forEach((it) => (it.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((it) => {
      if (filters.type && it.type !== filters.type) return false;
      if (filters.funnelStage && it.funnelStage !== filters.funnelStage) return false;
      if (filters.tag && !(it.tags ?? []).includes(filters.tag)) return false;
      if (q) {
        const inTitle = it.title.toLowerCase().includes(q);
        const inTags = (it.tags ?? []).some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inTags) return false;
      }
      return true;
    });
  }, [items, filters]);

  const onRegistered = (item) => {
    if (!item) return;
    setItems((prev) => {
      const rest = prev.filter((p) => p.id !== item.id);
      const normalized = {
        ...item,
        tags: item.tags ?? [],
        category: item.category ?? null,
        isTemplate: item.isTemplate ?? false,
        externalId: item.externalId ?? null,
        createdAt:
          typeof item.createdAt === "string" ? item.createdAt : new Date(item.createdAt).toISOString(),
      };
      return [normalized, ...rest];
    });
  };

  const hasAny = items.length > 0;
  const openEditor = (documentId, item) => setEditor({ documentId, title: item?.title });

  return (
    <div className={`${ui.page} ${ui.container} space-y-6`}>
      <Link href="/assist" className={`inline-flex items-center gap-1 ${ui.link}`}>
        <HiOutlineArrowLeft className="h-4 w-4" />
        AE Assist
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className={ui.title}>Collateral templates</h1>
          <p className={ui.subtitle}>
            Your library of on-brand templates — one-pagers, battlecards, case studies and more.
            Register a template by pasting its HTML, then personalize it for a deal.
          </p>
        </div>
        <button type="button" className={`${ui.btnPrimary} shrink-0`} onClick={() => setRegisterOpen(true)}>
          <HiOutlinePlus className="h-4 w-4" />
          Register template
        </button>
      </div>

      {hasAny ? <FilterBar filters={filters} onChange={setFilters} tagOptions={tagOptions} /> : null}

      {!hasAny ? (
        <div className={`${ui.cardSurface} p-10 text-center`}>
          <h2 className={`${ui.titleSm} mb-2`}>No templates yet</h2>
          <p className={`${ui.body} max-w-md mx-auto mb-5`}>
            Register your first brand template by pasting its HTML and categorizing it Marketing or
            Sales.
          </p>
          <button type="button" className={ui.btnPrimary} onClick={() => setRegisterOpen(true)}>
            <HiOutlinePlus className="h-4 w-4" />
            Register template
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${ui.cardSurface} p-8 text-center`}>
          <p className={ui.body}>No templates match these filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((it) => (
            <CollateralTile key={it.id} item={it} onOpenEditor={openEditor} />
          ))}
        </div>
      )}

      <RegisterModal isOpen={registerOpen} onClose={() => setRegisterOpen(false)} onRegistered={onRegistered} />

      {editor ? (
        <CollateralEditorModal
          documentId={editor.documentId}
          title={editor.title}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </div>
  );
}

export default DashboardLayout()(CollateralClient);

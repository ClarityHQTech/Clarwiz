"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlinePlus } from "react-icons/hi2";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FilterBar from "./FilterBar";
import CollateralTile from "./CollateralTile";
import CollateralEditorModal from "./CollateralEditorModal";
import RegisterModal from "./RegisterModal";
import CollateralAssetLibrary from "./CollateralAssetLibrary";
import { ui } from "@/lib/brandUi";

const INITIAL_FILTERS = { q: "", type: "", funnelStage: "", tag: "" };

function CollateralTemplatesClient({
  templateItems: initialTemplateItems = [],
  collateralAssets: initialAssets = [],
}) {
  const [items, setItems] = useState(initialTemplateItems ?? []);
  const [assets, setAssets] = useState(initialAssets);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setItems(initialTemplateItems ?? []);
  }, [initialTemplateItems]);

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
        isTemplate: true,
        externalId: item.externalId ?? null,
        createdAt:
          typeof item.createdAt === "string" ? item.createdAt : new Date(item.createdAt).toISOString(),
      };
      return [normalized, ...rest];
    });
  };

  const openEditor = (documentId, item) => {
    if (item?.isPredefined) return;
    setEditor({ documentId, title: item?.title });
  };

  const handleDelete = useCallback(async (item) => {
    if (!item?.id || !item.isTemplate) return;

    const isPredefined = Boolean(item.isPredefined);
    const confirmMsg = isPredefined
      ? `Remove "${item.title}" from your workspace? NBA will no longer use this system template when creating collateral.`
      : `Delete "${item.title}"? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/assist/collateral?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not delete template");
        return;
      }
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      toast.success(data.removedPredefined ? "Removed from workspace" : "Template deleted");
    } catch {
      toast.error("Could not delete template");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const hasAny = items.length > 0;

  return (
    <div className={`${ui.page} ${ui.container} space-y-6`}>
      <Link href="/collaterals" className={`inline-flex items-center gap-1 ${ui.link}`}>
        <HiOutlineArrowLeft className="h-4 w-4" />
        Collateral
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className={ui.title}>Templates &amp; assets</h1>
          <p className={ui.subtitle}>
            Register on-brand HTML templates and upload images for your collateral library. System
            templates are read-only; custom templates are editable.
          </p>
        </div>
        <button type="button" className={`${ui.btnPrimary} shrink-0`} onClick={() => setRegisterOpen(true)}>
          <HiOutlinePlus className="h-4 w-4" />
          Register template
        </button>
      </div>

      <CollateralAssetLibrary initialAssets={assets} onChange={setAssets} />

      <h2 className={ui.titleSm}>Template library</h2>

      {hasAny ? <FilterBar filters={filters} onChange={setFilters} tagOptions={tagOptions} /> : null}

      {!hasAny ? (
        <div className={`${ui.cardSurface} p-10 text-center`}>
          <h2 className={`${ui.titleSm} mb-2`}>No templates yet</h2>
          <p className={`${ui.body} max-w-md mx-auto mb-5`}>
            Register your first brand template by pasting its HTML, or revisit the collateral page to
            seed system templates.
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
            <CollateralTile
              key={it.id}
              item={it}
              onOpenEditor={openEditor}
              onDelete={handleDelete}
              deleting={deletingId === it.id}
            />
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

export default DashboardLayout()(CollateralTemplatesClient);

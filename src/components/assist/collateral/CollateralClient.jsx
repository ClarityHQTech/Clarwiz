"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import FilterBar from "./FilterBar";
import CollateralTile from "./CollateralTile";
import CollateralEditorModal from "./CollateralEditorModal";
import RegisterModal from "./RegisterModal";

const INITIAL_FILTERS = { q: "", type: "", funnelStage: "", tag: "" };

/**
 * Collateral library client (cockpit grid). The directory reads as a library of
 * brand templates: register a template by pasting its HTML and categorizing it
 * Marketing/Sales, then open any tile in the live editor. Holds rows + filter
 * state, the Register modal, and the full-screen live editor.
 */
function CollateralClient({ items: initialItems }) {
  const [items, setItems] = useState(initialItems ?? []);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editor, setEditor] = useState(null); // { documentId, title }

  // Auto-open the live editor when arrived at via ?open=<documentId> (e.g. the
  // "View / edit asset →" link appended to an NBA email). Match the title from
  // the loaded directory rows when available.
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
    <AssistShell active="collaterals" crumbs={["Templates"]}>
      <div className="ck-page-header">
        <div className="ck-page-title-block">
          <div className="ck-eyebrow">Brand Template Library · Marketing + Sales</div>
          <h1 className="ck-page-title">
            Collateral <em>Templates</em>
          </h1>
          <p className="ck-page-subtitle">
            Your library of on-brand templates — one-pagers, battlecards, case studies and more.
            Register a template by pasting its HTML, then open any tile in the live editor to
            personalize it for a deal.
          </p>
        </div>
        <div className="ck-page-actions">
          <button type="button" className="ck-btn ck-btn-primary" onClick={() => setRegisterOpen(true)}>
            + Register template
          </button>
        </div>
      </div>

      {hasAny && <FilterBar filters={filters} onChange={setFilters} tagOptions={tagOptions} />}

      {!hasAny ? (
        <div className="ck-card" style={{ padding: 48, textAlign: "center" }}>
          <div className="ck-page-title" style={{ fontSize: 24, marginBottom: 12 }}>
            No templates <em>yet</em>
          </div>
          <p className="ck-page-subtitle" style={{ margin: "0 auto 20px" }}>
            Register your first brand template by pasting its HTML and categorizing it Marketing or
            Sales. It becomes an editable, personalizable asset for any deal.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button type="button" className="ck-btn ck-btn-primary" onClick={() => setRegisterOpen(true)}>
              + Register template
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ck-card">
          <div className="ck-empty">No templates match these filters.</div>
        </div>
      ) : (
        <div className="ck-collateral-grid">
          {filtered.map((it) => (
            <CollateralTile key={it.id} item={it} onOpenEditor={openEditor} />
          ))}
        </div>
      )}

      <RegisterModal isOpen={registerOpen} onClose={() => setRegisterOpen(false)} onRegistered={onRegistered} />

      {editor && (
        <CollateralEditorModal
          documentId={editor.documentId}
          title={editor.title}
          onClose={() => setEditor(null)}
        />
      )}
    </AssistShell>
  );
}

export default DashboardLayout()(CollateralClient);

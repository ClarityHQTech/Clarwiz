"use client";

import { useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import FilterBar from "./FilterBar";
import CollateralTile from "./CollateralTile";
import CollateralEditorModal from "./CollateralEditorModal";
import RegisterModal from "./RegisterModal";
import GenerateCollateralModal from "./GenerateCollateralModal";

const INITIAL_FILTERS = { q: "", type: "", funnelStage: "", tag: "" };

/**
 * Collateral Hub client (cockpit grid). Holds rows + filter state, renders the
 * type-badged tile grid, the Generate-with-AI + Register modals, and the
 * full-screen live editor (for GENERATED tiles backed by a Document).
 */
function CollateralClient({ items: initialItems }) {
  const [items, setItems] = useState(initialItems ?? []);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [editor, setEditor] = useState(null); // { documentId, title }

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
        externalId: item.externalId ?? null,
        createdAt:
          typeof item.createdAt === "string" ? item.createdAt : new Date(item.createdAt).toISOString(),
      };
      return [normalized, ...rest];
    });
  };

  const onGenerated = async () => {
    try {
      const res = await fetch("/api/assist/collateral");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) setItems(data.items);
      }
    } catch {
      /* the row exists server-side; a refresh will surface it */
    }
  };

  const hasAny = items.length > 0;
  const openEditor = (documentId, item) => setEditor({ documentId, title: item?.title });

  return (
    <AssistShell active="collaterals" crumbs={["Directory"]}>
      <div className="ck-page-header">
        <div className="ck-page-title-block">
          <div className="ck-eyebrow">Unified Directory · Marketing + Sales</div>
          <h1 className="ck-page-title">
            Collateral <em>Hub</em>
          </h1>
          <p className="ck-page-subtitle">
            Pitch decks, battlecards, case studies, one-pagers and email templates — generated,
            HeyParrot, pilot and uploaded sources unified, with best-match suggestions for any deal.
          </p>
        </div>
        <div className="ck-page-actions">
          <button type="button" className="ck-btn ck-btn-ghost" onClick={() => setGenOpen(true)}>
            ⚡ Generate with AI
          </button>
          <button type="button" className="ck-btn ck-btn-primary" onClick={() => setRegisterOpen(true)}>
            + Register collateral
          </button>
        </div>
      </div>

      {hasAny && <FilterBar filters={filters} onChange={setFilters} tagOptions={tagOptions} />}

      {!hasAny ? (
        <div className="ck-card" style={{ padding: 48, textAlign: "center" }}>
          <div className="ck-page-title" style={{ fontSize: 24, marginBottom: 12 }}>
            No collateral <em>yet</em>
          </div>
          <p className="ck-page-subtitle" style={{ margin: "0 auto 20px" }}>
            Register your first marketing or sales asset, or generate one with AI, to surface it as a
            best-match suggestion on deals.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button type="button" className="ck-btn ck-btn-ghost" onClick={() => setGenOpen(true)}>
              ⚡ Generate with AI
            </button>
            <button type="button" className="ck-btn ck-btn-primary" onClick={() => setRegisterOpen(true)}>
              + Register collateral
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ck-card">
          <div className="ck-empty">No collateral matches these filters.</div>
        </div>
      ) : (
        <div className="ck-collateral-grid">
          {filtered.map((it) => (
            <CollateralTile key={it.id} item={it} onOpenEditor={openEditor} />
          ))}
        </div>
      )}

      <RegisterModal isOpen={registerOpen} onClose={() => setRegisterOpen(false)} onRegistered={onRegistered} />
      <GenerateCollateralModal isOpen={genOpen} onClose={() => setGenOpen(false)} onGenerated={onGenerated} />

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

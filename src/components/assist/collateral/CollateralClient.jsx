"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiOutlineCog6Tooth, HiOutlinePlus } from "react-icons/hi2";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CollateralEditorModal from "./CollateralEditorModal";
import CollateralCreateModal from "./CollateralCreateModal";
import CreatedCollateralSection from "./CreatedCollateralSection";
import { ui } from "@/lib/brandUi";

function CollateralClient({
  createdItems: initialCreatedItems = [],
  deals = [],
  templates = [],
}) {
  const [createdItems, setCreatedItems] = useState(initialCreatedItems ?? []);
  const [createOpen, setCreateOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const router = useRouter();

  useEffect(() => {
    setCreatedItems(initialCreatedItems ?? []);
  }, [initialCreatedItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const open = new URLSearchParams(window.location.search).get("open");
    if (!open) return;
    setEditor((prev) => {
      if (prev) return prev;
      const match = (initialCreatedItems ?? []).find((it) => it.externalId === open);
      return { documentId: open, title: match?.title };
    });
  }, [initialCreatedItems]);

  const openCreatedEditor = (item) => {
    if (!item?.externalId) return;
    setEditor({ documentId: item.externalId, title: item.title });
  };

  const handleCreated = useCallback(
    (item) => {
      if (item) {
        setCreatedItems((prev) => {
          const rest = prev.filter((p) => p.id !== item.id);
          return [item, ...rest];
        });
      }
      router.refresh();
    },
    [router],
  );

  return (
    <div className={`${ui.page} ${ui.container} space-y-8`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className={ui.title}>Collateral</h1>
          <p className={ui.subtitle}>
            Create hyper-personalized collateral for prospects and deals. All saved instances appear
            below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="button" className={ui.btnPrimary} onClick={() => setCreateOpen(true)}>
            <HiOutlinePlus className="h-4 w-4" />
            Create collateral
          </button>
          <Link href="/collaterals/templates" className={ui.btnSecondarySurface}>
            <HiOutlineCog6Tooth className="h-4 w-4" />
            Templates &amp; assets
          </Link>
        </div>
      </div>

      <CreatedCollateralSection items={createdItems} onEdit={openCreatedEditor} />

      <CollateralCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        deals={deals}
        templates={templates}
        onCreated={handleCreated}
        onOpenEditor={setEditor}
      />

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

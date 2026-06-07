"use client";

import { useEffect } from "react";
import CollateralLiveEditor from "@/components/assist/collateral/CollateralLiveEditor";

/**
 * Full-screen dark modal hosting the live collateral editor (built by another
 * agent). Mounts CollateralLiveEditor with the backing Document id; closing is
 * delegated up through onClose.
 */
export default function CollateralEditorModal({ documentId, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!documentId) return null;

  return (
    <div className="cockpit">
      <div className="ck-editor-modal" role="dialog" aria-label="Collateral editor">
        <div className="ck-editor-topbar">
          <div className="ck-card-title">
            Live editor
            {title ? <span className="ck-card-title-count">{title}</span> : null}
          </div>
          <button type="button" className="ck-btn ck-btn-ghost" onClick={onClose}>
            Close ✕
          </button>
        </div>
        <div className="ck-editor-body">
          <CollateralLiveEditor documentId={documentId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

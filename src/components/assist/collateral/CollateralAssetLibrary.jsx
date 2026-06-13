"use client";

import { useState } from "react";
import { HiOutlinePhoto, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

const ROLES = [
  { value: "logo", label: "Logo" },
  { value: "hero", label: "Hero image" },
  { value: "general", label: "General" },
];

export default function CollateralAssetLibrary({ initialAssets = [], onChange }) {
  const [assets, setAssets] = useState(initialAssets);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [role, setRole] = useState("general");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const sync = (next) => {
    setAssets(next);
    onChange?.(next);
  };

  const addAsset = async () => {
    if (!url.trim()) {
      toast.error("Image URL is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/assist/collateral/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "Image", url: url.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error === "valid_url_required" ? "Enter a valid https URL" : "Could not save asset");
        return;
      }
      sync(data.assets || []);
      setTitle("");
      setUrl("");
      toast.success("Asset saved");
    } catch {
      toast.error("Could not save asset");
    } finally {
      setSaving(false);
    }
  };

  const removeAsset = async (id) => {
    if (!window.confirm("Remove this image from the library?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/assist/collateral/assets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Could not remove asset");
        return;
      }
      sync(data.assets || []);
      toast.success("Asset removed");
    } catch {
      toast.error("Could not remove asset");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className={`${ui.cardSurface} p-5 space-y-4`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-terracotta/15 text-brand-terracotta">
          <HiOutlinePhoto className="h-5 w-5" />
        </div>
        <div>
          <h2 className={ui.titleSm}>Image library</h2>
          <p className={`${ui.body} text-sm mt-1`}>
            Store logo and hero image URLs used when filling rich Clarwiz templates (brochure, battlecard,
            deck). PDF-safe — use hosted https links.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="text"
          className={ui.input}
          placeholder="Label (e.g. Clarwiz logo)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="url"
          className={`${ui.input} sm:col-span-2`}
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <select className={ui.input} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className={ui.btnSecondarySurface} onClick={addAsset} disabled={saving}>
        <HiOutlinePlus className="h-4 w-4" />
        {saving ? "Saving…" : "Add image"}
      </button>

      {assets.length > 0 ? (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets.map((a) => (
            <li key={a.id} className="border border-brand-secondary/20 rounded-lg overflow-hidden flex flex-col">
              <div className="h-28 bg-brand-bg flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.title} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-ink truncate">{a.title}</p>
                  <p className="text-xs text-brand-stone capitalize">{a.role}</p>
                </div>
                <button
                  type="button"
                  className="text-brand-stone hover:text-red-600 p-1"
                  onClick={() => removeAsset(a.id)}
                  disabled={deletingId === a.id}
                  aria-label={`Remove ${a.title}`}
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-brand-stone">No images yet — add a logo or hero URL above.</p>
      )}
    </section>
  );
}

"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import MofuTabs from "@/components/mofu/MofuTabs";
import { ui } from "@/lib/brandUi";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const [data, setData] = useState({ builtin: [], custom: [] });
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState("SEND_MARKETING_COLLATERAL");
  const [scaffold, setScaffold] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mofu/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      setData(await res.json());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addTemplate = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      const res = await fetch("/api/mofu/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, actionType, promptScaffold: scaffold }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.reason || "Failed to save");
      toast.success("Template added");
      setTitle("");
      setScaffold("");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${ui.page} ${ui.container} max-w-[1100px] space-y-5`}>
      <div>
        <h1 className={ui.title}>Marketing Hub</h1>
        <p className={ui.subtitle}>Collateral templates — built-in code templates plus your own. Generate per deal from the deal page.</p>
      </div>
      <MofuTabs />

      <section className={`${ui.cardSurface} p-4 space-y-3`}>
        <h2 className={`${ui.titleSm} text-base`}>Add a template</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Template name (e.g. ROI one-pager)"
            className="rounded-md border border-brand-secondary/40 px-3 py-2 text-sm bg-white"
          />
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="rounded-md border border-brand-secondary/40 px-3 py-2 text-sm bg-white"
          >
            <option value="SEND_MARKETING_COLLATERAL">Marketing (Path A)</option>
            <option value="SEND_SALES_COLLATERAL">Sales (Path B)</option>
          </select>
        </div>
        <textarea
          value={scaffold}
          onChange={(e) => setScaffold(e.target.value)}
          placeholder="Prompt scaffold / instructions used when generating this collateral…"
          rows={3}
          className="w-full rounded-md border border-brand-secondary/40 px-3 py-2 text-sm bg-white"
        />
        <button
          onClick={addTemplate}
          disabled={saving}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-sm bg-brand-ink text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add template"}
        </button>
      </section>

      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
          <h2 className={`${ui.titleSm} text-base`}>Available templates</h2>
        </div>
        <div className={ui.divider}>
          {loading ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">Loading…</p>
          ) : (
            [...data.builtin, ...data.custom].map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-brand-ink">{t.title}</p>
                  <p className="text-xs text-brand-stone mt-0.5">
                    {t.actionType} {t.builtin ? "· built-in" : "· custom"}
                  </p>
                </div>
                {t.builtin && <span className="text-xs text-brand-steel">code template</span>}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(Page);

"use client";

import "../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MofuTabs from "@/components/mofu/MofuTabs";
import PageHeader from "@/components/mofu/ui/PageHeader";
import { ui } from "@/lib/brandUi";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const [data, setData] = useState({ builtin: [], custom: [] });
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("marketing");
  const [html, setHtml] = useState("");
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
  useEffect(() => { load(); }, [load]);

  const addTemplate = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!html.trim()) return toast.error("Paste the template HTML");
    setSaving(true);
    try {
      const res = await fetch("/api/mofu/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, html }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.reason || "Failed to save");
      toast.success("Template uploaded");
      setTitle(""); setHtml("");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (id) => {
    try {
      await fetch(`/api/mofu/templates/${id}`, { method: "DELETE" });
      toast.success("Template removed");
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const all = [...data.builtin, ...data.custom];
  const marketing = all.filter((t) => (t.category ?? "marketing") === "marketing");
  const sales = all.filter((t) => t.category === "sales");

  const Section = ({ label, items }) => (
    <section className="mofu card" style={{ overflow: "hidden" }}>
      <div className="card-h"><span className="t">{label}</span><span className="s">{items.length} template(s)</span></div>
      <div className="card-b" style={{ padding: 0 }}>
        {!items.length ? (
          <p className="muted" style={{ padding: "16px", textAlign: "center" }}>No {label.toLowerCase()} templates yet.</p>
        ) : (
          items.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div><div style={{ fontWeight: 650 }}>{t.title}</div><div className="muted">{t.source === "builtin" ? "built-in code template" : "uploaded HTML"}</div></div>
              {t.source !== "builtin" && <button className="btn btn-ghost btn-sm" onClick={() => removeTemplate(t.id)}>Delete</button>}
            </div>
          ))
        )}
      </div>
    </section>
  );

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1100px] space-y-5`}>
      <PageHeader title="Collateral" subtitle="One library of templates — upload your own HTML, categorised Marketing or Sales. Generate per deal from the deal's Collateral tab." />
      <MofuTabs />

      <section className="mofu card" style={{ padding: 16 }}>
        <h2 className="card-h" style={{ padding: 0, border: "none", marginBottom: 10 }}><span className="t">Upload a template</span></h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, marginBottom: 10 }}>
          <input className="inp" style={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 9, padding: "10px 12px" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Template name (e.g. ROI one-pager)" />
          <select className="inp" style={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 9, padding: "10px 12px" }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="marketing">Marketing</option>
            <option value="sales">Sales</option>
          </select>
        </div>
        <textarea className="inp" style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 9, padding: "10px 12px", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12 }} rows={6} value={html} onChange={(e) => setHtml(e.target.value)} placeholder="<html>… your template HTML. Use deal/company tokens; the engine fills it from the deal ontology.</html>" />
        <button className="btn btn-pri" style={{ marginTop: 10 }} onClick={addTemplate} disabled={saving}>{saving ? "Saving…" : "Upload template"}</button>
      </section>

      {loading ? <p className={ui.body}>Loading…</p> : (
        <div className="space-y-5">
          <Section label="Marketing" items={marketing} />
          <Section label="Sales" items={sales} />
        </div>
      )}
    </div>
  );
};

export default DashboardLayout()(Page);

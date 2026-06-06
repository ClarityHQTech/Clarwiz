"use client";

import "../../../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const { hubspotDealId } = useParams();
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("builtin:one_pager");
  const [doc, setDoc] = useState(null);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [dealName, setDealName] = useState("");

  const post = async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: res.ok, json: await res.json().catch(() => ({})) };
  };
  const refreshDoc = async (id) => {
    const res = await fetch(`/api/mofu/documents/${id}`);
    if (res.ok) setDoc((await res.json()).document);
  };

  const load = useCallback(async () => {
    try {
      const [t, d, i] = await Promise.all([
        fetch("/api/mofu/templates").then((r) => r.json()).catch(() => ({ builtin: [], custom: [] })),
        fetch(`/api/mofu/deals/${hubspotDealId}/collateral`).then((r) => (r.ok ? r.json() : { documents: [] })),
        fetch(`/api/mofu/deals/${hubspotDealId}/insights`).then((r) => (r.ok ? r.json() : null)),
      ]);
      setTemplates([...(t.builtin || []), ...(t.custom || [])]);
      setDocs(d.documents || []);
      setDealName(i?.deal?.name || "");
    } catch {
      /* ignore */
    }
  }, [hubspotDealId]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    const tmpl = templates.find((t) => t.id === templateId);
    setBusy(true);
    setDoc(null);
    setChat([{ who: "ai", text: "Generating from this deal's context…" }]);
    try {
      const { ok, json } = await post(`/api/mofu/deals/${hubspotDealId}/collateral`, { templateId, category: tmpl?.category ?? "marketing" });
      if (!ok) throw new Error(json.reason || "Generate failed");
      await refreshDoc(json.documentId);
      setChat([{ who: "ai", text: "Generated from the deal ontology. Ask for an edit and I'll re-run and save a new version." }]);
      toast.success("Collateral generated");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enrich = async () => {
    if (!chatInput.trim() || !doc) return;
    const msg = chatInput.trim();
    setChat((c) => [...c, { who: "me", text: msg }]);
    setChatInput(""); setBusy(true);
    try {
      const { ok, json } = await post(`/api/mofu/documents/${doc.id}/enrich`, { message: msg });
      if (!ok) throw new Error(json.reason || "Enrich failed");
      await refreshDoc(doc.id);
      setChat((c) => [...c, { who: "ai", text: "Updated and saved a new version." }]);
      toast.success("Re-enriched · new version");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = () => doc && window.open(`/api/mofu/documents/${doc.id}/html`, "_blank");

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1200px]`}>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="crumb" style={{ fontSize: 12 }}><Link href={`/mofu/deals/${hubspotDealId}`} className="crumb">{dealName || "Deal"}</Link> / Collateral</div>
          <div className="pt" style={{ marginTop: 2 }}>Collateral</div>
          <div className="ps">Pick a template, generate from this deal&apos;s context, refine on the fly, attach to a send.</div>
        </div>
      </div>

      <section className="card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="inp" style={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 9, padding: "8px 12px", minWidth: 240 }} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.title} · {(t.category ?? "marketing")}</option>)}
        </select>
        <button className="btn btn-pri" onClick={generate} disabled={busy}>{busy ? "Working…" : "Generate from this deal"}</button>
        <span className="muted">{docs.length} generated · <Link href="/mofu/collateral" className="crumb" style={{ color: "var(--accent-ink)" }}>manage templates</Link></span>
      </section>

      {doc && (
        <div className="editor">
          <div className="ed-chat">
            <div className="ech">💬 Refine on the fly</div>
            <div className="ed-msgs">{chat.map((m, i) => <div key={i} className={`msg ${m.who}`}>{m.text}</div>)}</div>
            <div className="ed-in">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask for an edit…" disabled={busy} onKeyDown={(e) => e.key === "Enter" && enrich()} />
              <button className="btn btn-pri btn-sm" onClick={enrich} disabled={busy}>Send</button>
            </div>
          </div>
          <div className="ed-doc">
            <iframe className="paper-frame" title="collateral" srcDoc={doc.renderedHtml || "<p style='font-family:sans-serif;padding:24px;color:#888'>No content.</p>"} />
          </div>
          <div className="ed-ver">
            <div className="evh">Versions</div>
            {Array.from({ length: doc.version || 1 }, (_, i) => i + 1).reverse().map((v) => (
              <div key={v} className={`ver ${v === doc.version ? "sel" : ""}`}><b>v{v}</b>{v === doc.version ? " · current" : ""}<div className="vm">{doc.status}</div></div>
            ))}
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={exportPdf}>Export / Print</button>
            <p className="muted" style={{ marginTop: 8 }}>Use this on a “Send collateral” NBA from the deal page to attach it.</p>
          </div>
        </div>
      )}

      {!doc && (
        <section className="card overflow-hidden">
          <div className="card-h"><span className="t">Generated collateral</span></div>
          <div className="card-b" style={{ padding: 0 }}>
            {!docs.length ? <p className="muted" style={{ padding: 16, textAlign: "center" }}>None yet — pick a template and generate.</p> : docs.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <div><div style={{ fontWeight: 650 }}>{d.title}</div><div className="muted">{d.category} · v{d.version} · {d.status}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => refreshDoc(d.id)}>Open</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardLayout()(Page);

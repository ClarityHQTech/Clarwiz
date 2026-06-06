"use client";

import "../../../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const STEPS = ["Resolve", "Research", "Enrich", "Plan", "Generate", "QC", "Assemble"];

const Page = () => {
  const { hubspotDealId } = useParams();
  const [ctx, setCtx] = useState({ dealName: "", company: "" });
  const [path, setPath] = useState(null);
  const [doc, setDoc] = useState(null);
  const [running, setRunning] = useState(false);
  const [pipeStep, setPipeStep] = useState(0);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/mofu/deals/${hubspotDealId}/insights`);
      if (res.ok) {
        const j = await res.json();
        setCtx({ dealName: j.deal?.name || "", company: j.company?.name || "" });
      }
    } catch {
      /* ignore */
    }
  }, [hubspotDealId]);
  useEffect(() => { loadContext(); }, [loadContext]);

  const post = async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: res.ok, json: await res.json().catch(() => ({})) };
  };
  const refreshDoc = async (id) => {
    const res = await fetch(`/api/mofu/documents/${id}`);
    if (res.ok) setDoc((await res.json()).document);
  };

  const pickA = async () => {
    setPath("A"); setRunning(false); setDoc(null); setBusy(true);
    try {
      const { ok, json } = await post(`/api/mofu/deals/${hubspotDealId}/collateral`, {
        path: "A",
        data: { headline: `Why teams choose us`, clientName: ctx.company || ctx.dealName, subhead: ctx.dealName, cta: "Let's talk" },
      });
      if (!ok) throw new Error(json.error || "Generate failed");
      await refreshDoc(json.documentId);
      toast.success("Path A — rendered instantly from the brand template");
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const pickB = async () => {
    setPath("B"); setDoc(null); setBusy(true); setRunning(true); setPipeStep(0);
    const timer = setInterval(() => setPipeStep((s) => Math.min(s + 1, STEPS.length)), 380);
    try {
      const enq = await post(`/api/mofu/deals/${hubspotDealId}/collateral`, {
        path: "B",
        brief: `Sales battlecard for ${ctx.dealName || "this deal"}${ctx.company ? ` at ${ctx.company}` : ""}: lead with our differentiators vs. the incumbent.`,
      });
      if (!enq.ok) throw new Error(enq.json.error || "Enqueue failed");
      const id = enq.json.documentId;
      const run = await post(`/api/mofu/documents/${id}/run`);
      clearInterval(timer); setPipeStep(STEPS.length);
      if (!run.ok) throw new Error(run.json.reason || "Pipeline failed");
      await refreshDoc(id);
      setChat([{ who: "ai", text: "Generated the battlecard from deal intel. Ask for an edit and I'll re-run QC and save a new version." }]);
      toast.success("Sales collateral assembled · jury QC passed");
    } catch (err) {
      clearInterval(timer); toast.error(err.message);
    } finally { setRunning(false); setBusy(false); }
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
      setChat((c) => [...c, { who: "ai", text: "Updated the draft, re-ran the jury QC, and saved a new version." }]);
      toast.success("Re-enriched · new version saved");
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const exportPdf = () => doc && window.open(`/api/mofu/documents/${doc.id}/html`, "_blank");

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1200px]`}>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="crumb" style={{ fontSize: 12 }}><Link href={`/mofu/deals/${hubspotDealId}`} className="crumb">{ctx.dealName || "Deal"}</Link> / Collateral</div>
          <div className="pt" style={{ marginTop: 2 }}>Collateral</div>
          <div className="ps">Two generation paths. Both ride the same edit → approve → send rails.</div>
        </div>
      </div>

      <div className="col-tabs">
        <button className={`col-pick ${path === "A" ? "sel" : ""}`} onClick={pickA} disabled={busy}>
          <div className="ph"><div className="pico pa-c">▤</div><div><b>Path A · Marketing</b><div className="pt">CODE-TEMPLATE · INSTANT</div></div></div>
          <p>Fixed brand template, personalized from deal fields. No LLM — deterministic, fast.</p>
        </button>
        <button className={`col-pick ${path === "B" ? "sel" : ""}`} onClick={pickB} disabled={busy}>
          <div className="ph"><div className="pico pb-c">⚡</div><div><b>Path B · Sales</b><div className="pt">LLM PIPELINE · QUEUED JOB</div></div></div>
          <p>Multi-step research → generate → QC. Chat re-enrichment &amp; versions. Battlecards live here.</p>
        </button>
      </div>

      {running && (
        <div className="pipe">
          <div className="pipe-h"><div className="spin" /><div><div style={{ fontWeight: 720, fontSize: 14 }}>Generating sales battlecard…</div><div className="muted">Queued job · resolve → research → enrich → plan → generate → QC → assemble</div></div><div className="spacer" /><span className="badge violet">dual-model jury QC</span></div>
          <div className="pipe-steps">{STEPS.map((s, i) => <div key={s} className={`pstep ${i < pipeStep ? "done" : ""}`}><div className="pc"><i /></div>{s}</div>)}</div>
        </div>
      )}

      {doc && !running && (
        <div className="editor">
          <div className="ed-chat">
            <div className="ech">💬 Refine by chat {path === "A" ? "(Path B only)" : ""}</div>
            <div className="ed-msgs">{chat.map((m, i) => <div key={i} className={`msg ${m.who}`}>{m.text}</div>)}</div>
            <div className="ed-in">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={path === "B" ? "Ask for an edit…" : "Path A is deterministic"} disabled={path !== "B" || busy} onKeyDown={(e) => e.key === "Enter" && enrich()} />
              <button className="btn btn-pri btn-sm" onClick={enrich} disabled={path !== "B" || busy}>Send</button>
            </div>
          </div>
          <div className="ed-doc">
            <iframe className="paper-frame" title="collateral" srcDoc={doc.renderedHtml || "<p style='font-family:sans-serif;padding:24px;color:#888'>No rendered content.</p>"} />
          </div>
          <div className="ed-ver">
            <div className="evh">Versions</div>
            {Array.from({ length: doc.version || 1 }, (_, i) => i + 1).reverse().map((v) => (
              <div key={v} className={`ver ${v === doc.version ? "sel" : ""}`}><b>v{v}</b>{v === doc.version ? " · current" : ""}<div className="vm">{v === doc.version ? `${doc.status}` : "previous"}</div></div>
            ))}
            <button className="btn btn-pri btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => toast.success("Use this on a Send NBA from the deal page")}>✓ Approve &amp; use</button>
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={exportPdf}>Export / Print</button>
          </div>
        </div>
      )}

      {!doc && !running && <div className="card"><div className="card-b"><p className="muted">Pick a path above to generate collateral for this deal.</p></div></div>}
    </div>
  );
};

export default DashboardLayout()(Page);

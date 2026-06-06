"use client";

import "../../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import HeptapodPanel from "@/components/mofu/HeptapodPanels";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const TABS = [
  ["overview", "Overview"],
  ["stakeholder", "Stakeholders"],
  ["value", "Value"],
  ["risk", "Risks"],
  ["temporal", "Timeline"],
  ["competitive", "Competitive"],
  ["expansion", "Expansion"],
  ["signals", "Signals"],
];
const OUTBOUND = new Set(["SEND_EMAIL", "SEND_MARKETING_COLLATERAL", "SEND_SALES_COLLATERAL", "SCHEDULE_MEETING", "NOTIFY_TEAM"]);

function money(a, c) {
  if (a == null) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD", maximumFractionDigits: 0 }).format(a); } catch { return `${a}`; }
}

const Page = () => {
  const { hubspotDealId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");
  // drawer
  const [drawer, setDrawer] = useState(null); // the rec being drafted
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState(null);
  const [contactView, setContactView] = useState(null);
  const [step, setStep] = useState(1); // 1 draft,2 edit,3 approve,4 send
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mofu/deals/${hubspotDealId}/insights`);
      if (!res.ok) throw new Error("Failed to load deal insights");
      setData(await res.json());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [hubspotDealId]);

  useEffect(() => { load(); }, [load]);

  const post = async (url, b) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    const json = await res.json();
    return { ok: res.ok, json };
  };

  const suggestNow = async () => {
    setBusy(true);
    try {
      const { ok, json } = await post(`/api/mofu/deals/${hubspotDealId}/recompute`);
      if (!ok) throw new Error(json.reason || "Recompute failed");
      toast.success("Recomputed NBA");
      await load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const toggleAutopilot = async () => {
    const next = !data?.deal?.autopilot;
    setBusy(true);
    try {
      const res = await fetch(`/api/mofu/deals/${hubspotDealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autopilot: next }) });
      if (!res.ok) throw new Error("Toggle failed");
      toast.success(next ? "Autopilot on — internal actions auto-run" : "Autopilot off");
      await load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const openDrawer = async (c) => {
    setDrawer(c);
    setSent(false);
    setStep(1);
    setSubject(c.payload?.draft?.subject ?? c.title);
    setRecipient(c.payload?.draft?.recipient ?? null);
    setBody(c.payload?.draft?.body ?? "Drafting…");
    setBusy(true);
    try {
      // Generate a real, recipient-addressed draft (no edits = fresh generation).
      const { ok, json } = await post(`/api/mofu/recommendations/${c.id}/draft`);
      if (ok && json.draft) {
        setSubject(json.draft.subject ?? c.title);
        setBody(json.draft.body ?? "");
        setRecipient(json.draft.recipient ?? null);
        setStep(2);
      }
    } catch {
      /* keep prefill */
    } finally {
      setBusy(false);
    }
  };
  const closeDrawer = () => setDrawer(null);

  const openContact = async (c) => {
    setContactView({ loading: true, contact: { name: c.name } });
    try {
      const res = await fetch(`/api/mofu/deals/${hubspotDealId}/contacts/${c.id}`);
      const j = await res.json();
      setContactView(res.ok ? j : { error: j.reason || "Not found", contact: { name: c.name } });
    } catch {
      setContactView({ error: "Failed to load", contact: { name: c.name } });
    }
  };

  const approveAndSend = async () => {
    if (!drawer) return;
    setBusy(true);
    try {
      setStep(2);
      await post(`/api/mofu/recommendations/${drawer.id}/draft`, { edits: { subject, body } });
      setStep(3);
      await post(`/api/mofu/recommendations/${drawer.id}/approve`);
      setStep(4);
      const { ok, json } = await post(`/api/mofu/recommendations/${drawer.id}/execute`);
      if (ok && (json.ok || json.idempotent)) {
        setSent(true);
        toast.success("Sent via HubSpot · engagement logged");
      } else {
        toast.error(
          json.reason === "hubspot_unauthorized" || json.reason === "hubspot_unavailable"
            ? "HubSpot rejected the write — your Private App token is read-only. Add write scopes (crm.objects.emails.write, tasks.write…) to send for real."
            : `HubSpot: ${json.reason || "send failed"}`
        );
      }
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className={`${ui.page} ${ui.container} max-w-[1200px]`}><p className={ui.body}>Loading deal…</p></div>;
  }

  const deal = data?.deal ?? {};
  const insight = data?.insight;
  const cards = data?.cards ?? [];
  const signals = data?.signals ?? [];
  const contacts = data?.contacts ?? [];
  const company = data?.company;
  const conf = insight?.systemMetadata?.confidence;
  const confPct = conf != null ? Math.round(Number(conf) * 100) : null;

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1200px]`}>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="crumb" style={{ fontSize: 12 }}><Link href="/mofu" className="crumb">Deals</Link> / {deal.name || hubspotDealId}</div>
          <div className="pt" style={{ marginTop: 2 }}>Deal Insights</div>
        </div>
        <div className="spacer" />
        <Link href={`/mofu/deals/${hubspotDealId}/collateral`} className="btn btn-ghost" style={{ marginRight: 10 }}>Collateral</Link>
        <button className="btn btn-ghost" onClick={toggleAutopilot} disabled={busy} style={{ marginRight: 10 }}>{deal.autopilot ? "Autopilot ✓" : "Autopilot"}</button>
        <button className="btn btn-ghost" onClick={suggestNow} disabled={busy}>⚡ {busy ? "Working…" : "Suggest now"}</button>
      </div>

      <div className="di-head">
        <div className="di-top">
          <div>
            <div className="name">{deal.name || `Deal ${hubspotDealId}`}</div>
            <div className="sub">
              <span>HubSpot deal #{deal.hubspotDealId} · live</span>
              <span className="badge amber">{deal.cachedStage || "—"}</span>
              <span className="badge gray">{deal.source}</span>
              {company && <span className="badge blue">{company.name}</span>}
            </div>
          </div>
          <div className="di-meta">
            <div className="m"><div className="mv">{money(deal.cachedAmount, deal.cachedCurrency)}</div><div className="ml">deal amount</div></div>
            {confPct != null && (
              <div className="m">
                <div className="conf">
                  <div className="ring" style={{ background: `conic-gradient(var(--green) 0 ${confPct}%, var(--surface-2) ${confPct}% 100%)` }}><i>{(conf).toFixed(2)}</i></div>
                  <div style={{ textAlign: "left" }}><div className="mv" style={{ fontSize: 13 }}>{confPct >= 70 ? "High" : confPct >= 40 ? "Med" : "Low"}</div><div className="ml">confidence</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="di-layout">
        {/* left: heptapod */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="tabs">
            {TABS.map(([key, label]) => (
              <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                {label}
                {key === "signals" && signals.length ? <span className="n">{signals.length}</span> : null}
              </button>
            ))}
          </div>
          <div className="dimpanel">
            <HeptapodPanel tab={tab} insight={insight} contacts={contacts} signals={signals} onContactClick={openContact} />
          </div>
        </div>

        {/* right: NBA rail */}
        <div className="nba-wrap">
          <div className="nba-h"><span style={{ color: "var(--accent)" }}>⚡</span><span className="t">Next Best Actions</span><span className="badge violet">{cards.length}</span></div>
          <div className="nba-list">
            {!cards.length ? (
              <p className="muted" style={{ padding: 8, textAlign: "center" }}>No NBA yet — click Suggest now.</p>
            ) : (
              cards.map((c, i) => {
                const internal = !OUTBOUND.has(c.actionType);
                return (
                  <div className={`nba ${c.gate?.executable ? "" : "gated"}`} key={c.id}>
                    <div className="nba-top">
                      <div className={`nba-ico ${internal ? "int" : ""}`}>{internal ? "▦" : "✉"}</div>
                      <div><div className="rank">#{i + 1} · {internal ? "Internal" : "External"}</div><div className="ti">{c.title}</div></div>
                    </div>
                    {c.payload?.rationale && <div className="why">{c.payload.rationale}</div>}
                    <div className="nba-meta">
                      {c.signalReferenceId && <span className="chip sig">↳ signal</span>}
                      <span className="chip">{c.actionType?.toLowerCase()}</span>
                      <span className="score">{Math.round(Number(c.score) * 100)}<span className="sb"><i style={{ width: `${Math.round(Number(c.score) * 100)}%` }} /></span></span>
                    </div>
                    <div className="nba-act">
                      {c.gate?.executable ? (
                        <button className="btn btn-pri btn-sm btn-block" onClick={() => openDrawer(c)}>Draft &amp; review</button>
                      ) : (
                        <button className="btn btn-gated btn-sm btn-block" onClick={() => toast.info(c.gate?.cta)}>{c.gate?.cta}</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* DRAWER */}
      <div className={`mofu-overlay ${drawer ? "show" : ""}`} onClick={closeDrawer} />
      <aside className={`mofu-drawer ${drawer ? "show" : ""}`}>
        {drawer && (
          <>
            <div className="dr-h">
              <div className="ico">✉</div>
              <div><div className="ti">{drawer.title}</div><div className="su">{drawer.actionType?.toLowerCase()} · {OUTBOUND.has(drawer.actionType) ? "external · AE owns the send" : "internal · no external send"}</div></div>
              <button className="dr-x" onClick={closeDrawer}>✕</button>
            </div>
            <div className="dr-b">
              <div className="rail">
                {["Suggested", "Draft", "Approve", "Send · HubSpot"].map((lab, i) => (
                  <div key={lab} className={`st ${step > i ? "done" : ""} ${step === i + 1 && !sent ? "active" : ""} ${sent && i === 3 ? "done" : ""}`}>
                    <div className="c">{step > i + 1 || sent ? "✓" : i + 1}</div><div className="lab">{lab}</div>
                  </div>
                ))}
              </div>
              {!sent ? (
                <div>
                  {OUTBOUND.has(drawer.actionType) && (
                    <>
                      <div className="field-l">To</div>
                      {recipient ? (
                        <input className="inp" readOnly value={`${recipient.name}${recipient.email ? ` <${recipient.email}>` : ""}`} />
                      ) : (
                        <div className="jury" style={{ background: "var(--red-soft)", borderColor: "#e7c9c4" }}>
                          ⚠️ <div>No associated contact on this deal — the email would log without a recipient. Add/associate a contact in HubSpot, then Suggest now.</div>
                        </div>
                      )}
                      <div className="field-l">Subject <span className="ai">AI</span></div>
                      <input className="inp" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </>
                  )}
                  <div className="field-l">{OUTBOUND.has(drawer.actionType) ? "Body" : "Brief"} <span className="ai">drafted from signals + company context</span></div>
                  <textarea className="inp" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
                  <div className="jury">⚖️ <div><b>Dual-model jury</b> ranked this action. Edits are saved as a new draft; the approve gate holds the send until you click.</div></div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 10px" }}>
                  <div style={{ fontSize: 34 }}>✓</div>
                  <h3 style={{ fontWeight: 740, fontSize: 17, marginTop: 8 }}>Sent via HubSpot</h3>
                  <p className="muted" style={{ marginTop: 6 }}>Logged as an engagement. A reply lands as a new signal and recomputes this deal&apos;s NBA automatically.</p>
                </div>
              )}
            </div>
            {!sent && (
              <div className="dr-f">
                <div className="note">Approve gate — nothing sends until you click.</div>
                <button className="btn btn-ghost" onClick={closeDrawer}>Dismiss</button>
                <button className="btn btn-pri" onClick={approveAndSend} disabled={busy}>{busy ? "Sending…" : "Approve & send"}</button>
              </div>
            )}
          </>
        )}
      </aside>

      {/* CONTACT DRAWER (contact-level view) */}
      <div className={`mofu-overlay ${contactView ? "show" : ""}`} onClick={() => setContactView(null)} />
      <aside className={`mofu-drawer ${contactView ? "show" : ""}`}>
        {contactView && (
          <>
            <div className="dr-h">
              <div className="ico">👤</div>
              <div><div className="ti">{contactView.contact?.name || "Contact"}</div><div className="su">{contactView.contact?.title || "contact"}{contactView.contact?.persona ? ` · ${contactView.contact.persona.toLowerCase().replace("_", " ")}` : ""}</div></div>
              <button className="dr-x" onClick={() => setContactView(null)}>✕</button>
            </div>
            <div className="dr-b">
              {contactView.loading ? (
                <p className="muted">Loading…</p>
              ) : contactView.error ? (
                <p className="muted">{contactView.error}</p>
              ) : (
                <>
                  <div className="field-l">Details</div>
                  <p style={{ fontSize: 13 }}>
                    {contactView.contact.email && <>✉ {contactView.contact.email}<br /></>}
                    {contactView.contact.phone && <>☎ {contactView.contact.phone}<br /></>}
                    {contactView.contact.role_type && <>Role: {contactView.contact.role_type} · influence {contactView.contact.influence_level || "?"} · {contactView.contact.engagement_status || "?"}</>}
                  </p>
                  {contactView.contact.recommended_approach && (
                    <>
                      <div className="field-l">Recommended approach</div>
                      <div className="jury">↳ <div>{contactView.contact.recommended_approach}</div></div>
                    </>
                  )}
                  <div className="field-l">Engagement &amp; signals</div>
                  {contactView.signals?.length ? contactView.signals.map((s) => (
                    <div className="feed-i" key={s.id}>
                      <div className="feed-ic fi-sig">∿</div>
                      <div><div className="ft"><b>{s.kind?.replace("_", " ")}</b></div><div className="fm">{s.summary}</div></div>
                      <div className="fr"><span className="badge blue">{Number(s.score).toFixed(2)}</span></div>
                    </div>
                  )) : <p className="muted">No signals tied to this contact yet.</p>}
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};

export default DashboardLayout()(Page);

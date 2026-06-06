"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { toast } from "sonner";

const DIMENSIONS = [
  ["overview", "Overview"],
  ["stakeholder", "Stakeholders"],
  ["value", "Value"],
  ["risk", "Risks"],
  ["temporal", "Timeline"],
  ["competitive", "Competitive"],
  ["expansion", "Expansion"],
];

function DimensionBody({ dim }) {
  if (!dim) return <p className="text-sm text-brand-stone">No data yet.</p>;
  const summary = dim.summary ?? (typeof dim === "string" ? dim : null);
  const findings = Array.isArray(dim.findings) ? dim.findings : [];
  return (
    <div className="space-y-2">
      {summary && <p className="text-sm text-brand-ink">{summary}</p>}
      {findings.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-brand-stone space-y-1">
          {findings.map((f, i) => (
            <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
          ))}
        </ul>
      )}
      {!summary && !findings.length && <p className="text-sm text-brand-stone">{JSON.stringify(dim)}</p>}
    </div>
  );
}

const Page = () => {
  const { hubspotDealId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

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

  useEffect(() => {
    load();
  }, [load]);

  const act = async (url, body, okMsg) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json();
      if (!res.ok) throw new Error(json.reason || json.error || "Action failed");
      toast.success(okMsg);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const suggestNow = () => act(`/api/mofu/deals/${hubspotDealId}/recompute`, null, "Recomputed NBA");

  const startEdit = (c) => {
    const companyName = data?.company?.name;
    const companySummary = data?.companyInsight?.executiveSummary?.summary;
    const ctx = companyName
      ? `\n\n[Company context] ${companyName}${companySummary ? `: ${companySummary}` : ""}`
      : "";
    const base = c.payload?.draft?.body ?? c.payload?.rationale ?? c.title;
    setEditText(`${base}${ctx}`);
    setEditingId(c.id);
  };

  const saveEdit = async (c) => {
    await act(`/api/mofu/recommendations/${c.id}/draft`, { edits: { subject: c.title, body: editText } }, "Saved edited draft");
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className={`${ui.page} ${ui.container} max-w-[1100px]`}>
        <p className={ui.body}>Loading deal…</p>
      </div>
    );
  }

  const deal = data?.deal;
  const insight = data?.insight;
  const cards = data?.cards ?? [];
  const signals = data?.signals ?? [];
  const dims = insight?.dimensions ?? {};
  const company = data?.company;
  const contacts = data?.contacts ?? [];
  const companyInsight = data?.companyInsight;

  return (
    <div className={`${ui.page} ${ui.container} max-w-[1100px] space-y-6`}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/mofu" className={`inline-flex items-center gap-1 ${ui.link}`}>
          <HiOutlineArrowLeft className="h-4 w-4" /> Deals
        </Link>
        <button
          onClick={suggestNow}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm bg-brand-ink text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Suggest now"}
        </button>
      </div>

      <div>
        <h1 className={ui.title}>{deal?.name || `Deal ${hubspotDealId}`}</h1>
        <p className={ui.subtitle}>
          {deal?.cachedStage || "—"} · {deal?.source} {deal?.autopilot ? "· autopilot" : ""}
        </p>
      </div>

      {/* Heptapod dimensions */}
      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-brand-secondary/25 bg-brand-surface">
          {DIMENSIONS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-sm rounded-md ${tab === key ? "bg-brand-sage/30 text-brand-ink" : "text-brand-stone hover:bg-brand-sage/15"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "overview" ? (
            <DimensionBody dim={insight?.executiveSummary ?? { summary: insight ? "See dimension tabs." : "No insight bundle yet — click Suggest now." }} />
          ) : (
            <DimensionBody dim={dims[tab]} />
          )}
          {insight?.systemMetadata && (
            <p className="text-xs text-brand-stone mt-3">
              confidence {insight.systemMetadata.confidence ?? "?"} · completeness {insight.systemMetadata.data_completeness ?? "?"}
            </p>
          )}
        </div>
      </section>

      {/* Company level */}
      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
          <h2 className={`${ui.titleSm} text-base`}>Company</h2>
          <p className="text-xs text-brand-stone mt-0.5">Company-level intelligence</p>
        </div>
        <div className="p-4">
          {!company ? (
            <p className="text-sm text-brand-stone">No associated company. Click Suggest now after linking a company in HubSpot.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-brand-ink">{company.name || "Company"}</p>
              <p className="text-xs text-brand-stone">
                {company.domain || "—"}{company.industry ? ` · ${company.industry}` : ""}
              </p>
              {companyInsight?.executiveSummary && (
                <DimensionBody dim={companyInsight.executiveSummary} />
              )}
              {companyInsight?.dimensions?.value && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-brand-steel mb-1">Value</p>
                  <DimensionBody dim={companyInsight.dimensions.value} />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Contact level */}
      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
          <h2 className={`${ui.titleSm} text-base`}>Contacts</h2>
          <p className="text-xs text-brand-stone mt-0.5">Stakeholders on this deal</p>
        </div>
        <div className={ui.divider}>
          {!contacts.length ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">No associated contacts.</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-brand-ink truncate">{c.name}</p>
                  <span className="text-xs text-brand-steel shrink-0">{c.title || ""}</span>
                </div>
                {c.email && <p className="text-xs text-brand-stone mt-0.5">{c.email}</p>}
              </div>
            ))
          )}
        </div>
      </section>

      {/* NBA cards */}
      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
          <h2 className={`${ui.titleSm} text-base`}>Next best actions</h2>
        </div>
        <div className={ui.divider}>
          {!cards.length ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">No NBA yet — click Suggest now.</p>
          ) : (
            cards.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-ink">{c.title}</p>
                    <p className="text-xs text-brand-stone mt-0.5">
                      {c.actionType} · score {Number(c.score).toFixed(2)} · {c.status}
                      {c.signalReferenceId ? ` · ${c.signalReferenceId}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => (editingId === c.id ? setEditingId(null) : startEdit(c))}
                      disabled={busy}
                      className="rounded-md px-2.5 py-1 text-xs border border-brand-secondary/40 hover:bg-brand-sage/15 disabled:opacity-50"
                    >
                      {editingId === c.id ? "Cancel" : "Edit"}
                    </button>
                    {!c.gate?.executable ? (
                      <span className="text-xs text-brand-steel">{c.gate?.cta}</span>
                    ) : (
                      <>
                        <button
                          onClick={() => act(`/api/mofu/recommendations/${c.id}/draft`, null, "Drafted")}
                          disabled={busy}
                          className="rounded-md px-2.5 py-1 text-xs border border-brand-secondary/40 hover:bg-brand-sage/15 disabled:opacity-50"
                        >
                          Draft
                        </button>
                        <button
                          onClick={() => act(`/api/mofu/recommendations/${c.id}/approve`, null, "Approved")}
                          disabled={busy}
                          className="rounded-md px-2.5 py-1 text-xs border border-brand-secondary/40 hover:bg-brand-sage/15 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => act(`/api/mofu/recommendations/${c.id}/execute`, null, "Sent via HubSpot")}
                          disabled={busy}
                          className="rounded-md px-2.5 py-1 text-xs bg-brand-ink text-white hover:opacity-90 disabled:opacity-50"
                        >
                          Send
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingId === c.id && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={5}
                      className="w-full rounded-md border border-brand-secondary/40 px-3 py-2 text-sm bg-white"
                    />
                    <button
                      onClick={() => saveEdit(c)}
                      disabled={busy}
                      className="rounded-md px-3 py-1.5 text-xs bg-brand-ink text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Save edited draft
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Signals */}
      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
          <h2 className={`${ui.titleSm} text-base`}>Signals</h2>
        </div>
        <div className={ui.divider}>
          {!signals.length ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">No signals captured yet.</p>
          ) : (
            signals.map((s) => (
              <div key={s.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-brand-ink truncate">{s.summary || s.kind}</p>
                  <span className="text-xs text-brand-steel shrink-0">{s.kind} · {Number(s.score).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(Page);

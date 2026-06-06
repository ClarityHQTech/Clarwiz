"use client";

import "../../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const TABS = [["overview", "Overview"], ["stakeholder", "Stakeholders"], ["expansion", "Expansion"], ["deals", "Deals"]];
const PERSONA_COLOR = { DECISION_MAKER: "#7e8f6e", INFLUENCER: "#8b9a9c", OTHER: "#bf8a6f" };
function money(a, c) { if (a == null) return "—"; try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD", maximumFractionDigits: 0 }).format(a); } catch { return `${a}`; } }
function initials(n) { return (n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
function DimBody({ dim }) {
  if (!dim) return <p className="muted">No data yet.</p>;
  const s = dim.summary ?? (typeof dim === "string" ? dim : null);
  const f = Array.isArray(dim.findings) ? dim.findings : [];
  return <div>{s && <p style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s}</p>}{f.length > 0 && <ul style={{ margin: "8px 0 0 16px" }}>{f.map((x, i) => <li key={i} style={{ fontSize: 12.5, color: "var(--text-2)" }}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul>}{!s && !f.length && <p className="muted">{JSON.stringify(dim)}</p>}</div>;
}

const Page = () => {
  const { companyId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mofu/companies/${companyId}/insights`);
      if (!res.ok) throw new Error("Failed to load company insights");
      setData(await res.json());
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className={`${ui.page} ${ui.container} max-w-[1100px]`}><p className={ui.body}>Loading company…</p></div>;
  const company = data?.company ?? {};
  const insight = data?.insight;
  const dims = insight?.dimensions ?? {};
  const deals = data?.deals ?? [];
  const contacts = data?.contacts ?? [];

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1100px]`}>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div><div className="crumb" style={{ fontSize: 12 }}><Link href="/mofu/companies" className="crumb">Companies</Link> / {company.name}</div><div className="pt" style={{ marginTop: 2 }}>Company Insights</div></div>
      </div>

      <div className="di-head">
        <div className="di-top">
          <div><div className="name">{company.name || "Company"}</div>
            <div className="sub"><span>{company.domain || "—"}{company.industry ? ` · ${company.industry}` : ""}</span><span className="badge gray">{company.dealCount} deal(s)</span></div></div>
          <div className="di-meta"><div className="m"><div className="mv">{company.dealCount}</div><div className="ml">active deals</div></div></div>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>)}</div>
        <div className="dimpanel">
          {tab === "overview" && (
            <>
              <div style={{ background: "var(--accent-soft)", border: "1px solid #e6d6c4", borderRadius: 11, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 750, fontSize: 13, color: "var(--accent-ink)", marginBottom: 5 }}>Account intelligence summary</div>
                <DimBody dim={insight?.executiveSummary ?? { summary: insight ? "See tabs." : "No company bundle yet — open a deal and Suggest now to compute account intelligence." }} />
              </div>
              <div className="cap-note"><span className="tag">same Heptapod shape</span> Company scope reuses the deal bundle dimensions, rolled up across the account.</div>
            </>
          )}
          {tab === "stakeholder" && (contacts.length ? contacts.map((c) => (
            <div className="person" key={c.id}><div className="pa" style={{ background: PERSONA_COLOR[c.persona] || "#bf8a6f" }}>{initials(c.name)}</div><div><div className="pn">{c.name}</div><div className="pr">{c.title || "—"}</div></div><div className="pright"><span className="badge gray">{(c.persona || "OTHER").toLowerCase().replace("_", " ")}</span></div></div>
          )) : <p className="muted">No contacts across this account.</p>)}
          {tab === "expansion" && <DimBody dim={dims.expansion} />}
          {tab === "deals" && (
            <table><thead><tr><th>Deal</th><th>Stage</th><th>Amount</th></tr></thead><tbody>
              {deals.map((d) => <tr key={d.hubspotDealId}><td><Link href={`/mofu/deals/${d.hubspotDealId}`} className="crumb" style={{ color: "var(--accent-ink)" }}>{d.name}</Link></td><td><span className="badge amber">{d.stage || "—"}</span></td><td>{money(d.amount, d.currency)}</td></tr>)}
            </tbody></table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout()(Page);

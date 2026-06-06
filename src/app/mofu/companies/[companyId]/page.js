"use client";

import "../../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import HeptapodPanel from "@/components/mofu/HeptapodPanels";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const TABS = [["overview", "Overview"], ["stakeholder", "Stakeholders"], ["expansion", "Expansion"], ["deals", "Deals"]];
function money(a, c) { if (a == null) return "—"; try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD", maximumFractionDigits: 0 }).format(a); } catch { return `${a}`; } }

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
          {tab === "deals" ? (
            <table><thead><tr><th>Deal</th><th>Stage</th><th>Amount</th></tr></thead><tbody>
              {deals.map((d) => <tr key={d.hubspotDealId}><td><Link href={`/mofu/deals/${d.hubspotDealId}`} className="crumb" style={{ color: "var(--accent-ink)" }}>{d.name}</Link></td><td><span className="badge amber">{d.stage || "—"}</span></td><td>{money(d.amount, d.currency)}</td></tr>)}
            </tbody></table>
          ) : (
            <HeptapodPanel tab={tab} insight={insight} contacts={contacts} signals={[]} />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout()(Page);

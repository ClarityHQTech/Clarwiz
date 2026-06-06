"use client";

import "../mofu.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MofuTabs from "@/components/mofu/MofuTabs";
import { ui } from "@/lib/brandUi";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const PERSONA_LABEL = {
  DECISION_MAKER: "Decision maker",
  INFLUENCER: "Influencer",
  CHAMPION: "Champion",
  OTHER: "Contact",
};

const Page = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mofu/contacts");
      if (!res.ok) throw new Error("Failed to load contacts");
      const json = await res.json();
      setContacts(json.contacts ?? []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`mofu ${ui.page} ${ui.container} max-w-[1100px] space-y-5`}>
      <div>
        <h1 className={ui.title}>Contacts</h1>
        <p className={ui.subtitle}>Stakeholders across your deals, with inferred personas.</p>
      </div>
      <MofuTabs />
      <section className={`${ui.cardSurface} overflow-hidden`}>
        <div className={ui.divider}>
          {loading ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">Loading…</p>
          ) : !contacts.length ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">
              No contacts yet. Associate contacts to deals in HubSpot, then Sync / Suggest now.
            </p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-ink truncate">{c.name}</p>
                    <p className="text-xs text-brand-stone mt-0.5">
                      {c.title || "—"}{c.email ? ` · ${c.email}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-brand-sage/25 text-brand-ink">
                      {PERSONA_LABEL[c.persona] ?? c.persona}
                    </span>
                  </div>
                </div>
                {(c.deals || []).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {c.deals.map((d) => (
                      <Link key={d.hubspotDealId} href={`/mofu/deals/${d.hubspotDealId}`} className="text-xs text-brand-steel hover:underline">
                        {d.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(Page);

"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import NewCampaignModal from "@/components/campaigns/NewCampaignModal";
import { STATUS_STYLES, ui } from "@/lib/brandUi";
import { useDisclosure } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlinePlus, HiOutlineChevronRight } from "react-icons/hi2";
import { toast } from "sonner";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPercent(value) {
  if (!value) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
    >
      {status}
    </span>
  );
}

const Page = () => {
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to load campaigns");
      const data = await res.json();
      setCampaigns(data);
    } catch {
      toast.error("Could not load campaigns.");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCreated = (campaign) => {
    setCampaigns((prev) => [campaign, ...prev]);
    router.push(`/campaigns/${campaign.id}`);
  };

  const totalProspects = campaigns.reduce((n, c) => n + c.prospects, 0);
  const totalQualified = campaigns.reduce((n, c) => n + c.qualifiedLeads, 0);
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className={`${ui.page} ${ui.container}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className={ui.title}>Campaigns</h1>
          <p className={ui.subtitle}>
            Run growth execution with unified brand context—track outreach,
            replies, and qualified pipeline in one place.
          </p>
        </div>
        <button type="button" onClick={onOpen} className={`${ui.btnPrimary} shrink-0`}>
          <HiOutlinePlus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total campaigns", value: campaigns.length },
          { label: "Active", value: activeCount },
          { label: "Prospects enrolled", value: totalProspects.toLocaleString() },
          { label: "Qualified leads", value: totalQualified },
        ].map(({ label, value }) => (
          <div key={label} className={ui.statCard}>
            <p className={ui.label}>{label}</p>
            <p className="mt-1 text-xl font-semibold text-brand-ink tabular-nums font-serif">
              {loading ? "—" : value}
            </p>
          </div>
        ))}
      </div>

      <div className={ui.tableWrap}>
        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-brand-stone">
            Loading campaigns…
          </div>
        ) : campaigns.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-brand-ink">No campaigns yet</p>
            <p className={`${ui.body} mt-1`}>
              Create your first campaign to start human-led outreach execution.
            </p>
            <button type="button" onClick={onOpen} className={`mt-4 ${ui.btnGhost}`}>
              New campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className={ui.tableHead}>
                  <th className={ui.tableHeadCell}>Campaign</th>
                  <th className={ui.tableHeadCell}>Status</th>
                  <th className={`${ui.tableHeadCell} text-right`}>Prospects</th>
                  <th className={`${ui.tableHeadCell} text-right`}>Sent</th>
                  <th className={`${ui.tableHeadCell} text-right`}>Open rate</th>
                  <th className={`${ui.tableHeadCell} text-right`}>Reply rate</th>
                  <th className={`${ui.tableHeadCell} text-right`}>Qualified</th>
                  <th className={ui.tableHeadCell}>Started</th>
                  <th className="w-10 px-2 py-3" aria-hidden />
                </tr>
              </thead>
              <tbody className={ui.divider}>
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                    className={`group ${ui.tableRowHover}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-ink group-hover:text-brand-dark transition-colors">
                        {campaign.name}
                      </p>
                      <p className="text-xs text-brand-stone mt-0.5 line-clamp-1 max-w-[240px]">
                        {campaign.description || campaign.targetSegment || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-brand-stone tabular-nums">
                      {campaign.prospects.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-stone tabular-nums">
                      {campaign.sent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-stone tabular-nums">
                      {formatPercent(campaign.openRate)}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-stone tabular-nums">
                      {formatPercent(campaign.replyRate)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-brand-ink tabular-nums">
                      {campaign.qualifiedLeads}
                    </td>
                    <td className="px-4 py-3 text-brand-stone text-xs whitespace-nowrap">
                      {formatDate(campaign.startDate)}
                    </td>
                    <td className="px-2 py-3 text-brand-steel group-hover:text-brand-terracotta">
                      <HiOutlineChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewCampaignModal
        isOpen={isOpen}
        onClose={onClose}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default DashboardLayout()(Page);

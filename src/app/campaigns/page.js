"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import NewCampaignModal from "@/components/campaigns/NewCampaignModal";
import { useDisclosure } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlinePlus, HiOutlineChevronRight } from "react-icons/hi2";
import { toast } from "sonner";

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20",
  draft: "bg-gray-100 text-gray-600 ring-gray-500/10",
  completed: "bg-sky-50 text-sky-700 ring-sky-600/20",
};

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
    <div className="p-5 lg:p-7 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage outreach campaigns and track performance at a glance.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 transition-colors shrink-0"
        >
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
          <div
            key={label}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </p>
            <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">
              {loading ? "—" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-gray-500">
            Loading campaigns…
          </div>
        ) : campaigns.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-gray-900">No campaigns yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Create your first campaign to start outreach.
            </p>
            <button
              type="button"
              onClick={onOpen}
              className="mt-4 text-sm font-medium text-sky-700 hover:text-sky-800"
            >
              New campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Campaign
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Prospects
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Sent
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Open rate
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Reply rate
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Qualified
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Started
                  </th>
                  <th className="w-10 px-2 py-3" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                    className="group cursor-pointer hover:bg-sky-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 group-hover:text-sky-800 transition-colors">
                        {campaign.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-[240px]">
                        {campaign.description || campaign.targetSegment || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {campaign.prospects.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {campaign.sent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {formatPercent(campaign.openRate)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {formatPercent(campaign.replyRate)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {campaign.qualifiedLeads}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {formatDate(campaign.startDate)}
                    </td>
                    <td className="px-2 py-3 text-gray-400 group-hover:text-sky-600">
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

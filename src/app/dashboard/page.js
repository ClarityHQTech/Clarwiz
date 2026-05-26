"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineArrowRight,
  HiOutlineChatBubbleLeftRight,
  HiOutlinePaperAirplane,
} from "react-icons/hi2";
import { toast } from "sonner";

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ActionIcon({ type }) {
  if (type === "reply") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <HiOutlineChatBubbleLeftRight className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
      <HiOutlinePaperAirplane className="h-4 w-4" />
    </span>
  );
}

const Page = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      setData(await res.json());
    } catch (err) {
      toast.error(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="p-5 lg:p-7">
        <p className="text-sm text-gray-500">Loading dashboard…</p>
      </div>
    );
  }

  const summary = data?.summary ?? {
    activeCampaigns: 0,
    totalCampaigns: 0,
    totalReplies: 0,
    totalSent: 0,
  };

  return (
    <div className="p-5 lg:p-7 max-w-[1200px] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Recent replies and outreach activity across your campaigns.
          </p>
        </div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          View campaigns
          <HiOutlineArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active campaigns", value: summary.activeCampaigns },
          { label: "Total campaigns", value: summary.totalCampaigns },
          {
            label: "Replies",
            value: summary.totalReplies,
            highlight: summary.totalReplies > 0,
          },
          { label: "Messages sent", value: summary.totalSent },
        ].map(({ label, value, highlight }) => (
          <div
            key={label}
            className={`rounded-lg border px-4 py-3 ${
              highlight
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-gray-200 bg-white"
            }`}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                highlight ? "text-emerald-800" : "text-gray-900"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/80">
            <h2 className="text-sm font-semibold text-gray-900">Recent replies</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Prospect responses across all campaigns
            </p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {!data?.recentReplies?.length ? (
              <p className="px-4 py-8 text-sm text-gray-500 text-center">
                No replies yet. Run a campaign and track engagement to capture replies
                see them here.
              </p>
            ) : (
              data.recentReplies.map((reply) => (
                <Link
                  key={reply.id}
                  href={`/campaigns/${reply.campaignId}`}
                  className="block px-4 py-3 hover:bg-emerald-50/40 transition-colors"
                >
                  <div className="flex gap-3">
                    <ActionIcon type="reply" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {reply.prospectName}
                          {reply.company && (
                            <span className="font-normal text-gray-500">
                              {" "}
                              · {reply.company}
                            </span>
                          )}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatRelative(reply.responseAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {reply.campaignName} · {reply.channelLabel}
                      </p>
                      <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">
                        {reply.responseContent}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/80">
            <h2 className="text-sm font-semibold text-gray-900">Recent actions</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Outbound messages, skips, and replies
            </p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {!data?.recentActions?.length ? (
              <p className="px-4 py-8 text-sm text-gray-500 text-center">
                No activity yet. Launch a drip or run execution on a campaign.
              </p>
            ) : (
              data.recentActions.map((action) => (
                <Link
                  key={action.id}
                  href={`/campaigns/${action.campaignId}`}
                  className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex gap-3">
                    <ActionIcon type={action.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {action.label}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatRelative(action.at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {action.prospectName} · {action.campaignName} ·{" "}
                        {action.channelLabel}
                      </p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {action.type === "reply"
                          ? action.responseContent
                          : action.message}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardLayout()(Page);

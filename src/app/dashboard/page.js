"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
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
      <span className={ui.iconReply}>
        <HiOutlineChatBubbleLeftRight className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className={ui.iconAction}>
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
      <div className={`${ui.page} ${ui.container} max-w-[1200px]`}>
        <p className={ui.body}>Loading dashboard…</p>
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
    <div className={`${ui.page} ${ui.container} max-w-[1200px] space-y-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={ui.title}>Dashboard</h1>
          <p className={ui.subtitle}>
            Recent replies and outreach activity—one source of truth for
            campaign execution.
          </p>
        </div>
        <Link href="/campaigns" className={`inline-flex items-center gap-1 ${ui.link}`}>
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
            className={`${ui.statCard} ${
              highlight ? "border-brand-sage/50 bg-brand-sage/25" : ""
            }`}
          >
            <p className={ui.label}>{label}</p>
            <p className={ui.statValue}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className={`${ui.cardSurface} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
            <h2 className={`${ui.titleSm} text-base`}>Recent replies</h2>
            <p className="text-xs text-brand-stone mt-0.5">
              Prospect responses across all campaigns
            </p>
          </div>
          <div className={`${ui.divider} max-h-[420px] overflow-y-auto`}>
            {!data?.recentReplies?.length ? (
              <p className="px-4 py-8 text-sm text-brand-stone text-center">
                No replies yet. Run a campaign and track engagement to see
                responses here.
              </p>
            ) : (
              data.recentReplies.map((reply) => (
                <Link
                  key={reply.id}
                  href={`/campaigns/${reply.campaignId}`}
                  className="block px-4 py-3 hover:bg-brand-sage/15 transition-colors"
                >
                  <div className="flex gap-3">
                    <ActionIcon type="reply" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-brand-ink truncate">
                          {reply.prospectName}
                          {reply.company && (
                            <span className="font-normal text-brand-stone">
                              {" "}
                              · {reply.company}
                            </span>
                          )}
                        </p>
                        <span className="text-xs text-brand-steel shrink-0">
                          {formatRelative(reply.responseAt)}
                        </span>
                      </div>
                      <p className="text-xs text-brand-stone mt-0.5">
                        {reply.campaignName} · {reply.channelLabel}
                      </p>
                      <p className="text-sm text-brand-stone mt-1.5 line-clamp-2">
                        {reply.responseContent}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className={`${ui.cardSurface} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface">
            <h2 className={`${ui.titleSm} text-base`}>Recent actions</h2>
            <p className="text-xs text-brand-stone mt-0.5">
              Outbound messages, skips, and replies
            </p>
          </div>
          <div className={`${ui.divider} max-h-[420px] overflow-y-auto`}>
            {!data?.recentActions?.length ? (
              <p className="px-4 py-8 text-sm text-brand-stone text-center">
                No activity yet. Launch a drip or run execution on a campaign.
              </p>
            ) : (
              data.recentActions.map((action) => (
                <Link
                  key={action.id}
                  href={`/campaigns/${action.campaignId}`}
                  className="block px-4 py-3 hover:bg-brand-secondary/10 transition-colors"
                >
                  <div className="flex gap-3">
                    <ActionIcon type={action.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-brand-ink">
                          {action.label}
                        </p>
                        <span className="text-xs text-brand-steel shrink-0">
                          {formatRelative(action.at)}
                        </span>
                      </div>
                      <p className="text-xs text-brand-stone mt-0.5">
                        {action.prospectName} · {action.campaignName} ·{" "}
                        {action.channelLabel}
                      </p>
                      <p className="text-sm text-brand-stone mt-1 line-clamp-2">
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

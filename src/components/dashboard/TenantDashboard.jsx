"use client";

import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { STATUS_STYLES, ui } from "@/lib/brandUi";
import { fmtAmountShort } from "@/components/assist/cockpit/format";
import { actionDot, actionLabel } from "@/components/assist/dashboard/ActivityFeed";
import DashboardHeaderActions from "@/components/dashboard/DashboardHeaderActions";
import {
  HiOutlineArrowRight,
  HiOutlineArrowTrendingUp,
  HiOutlineBriefcase,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheckBadge,
  HiOutlineEnvelopeOpen,
  HiOutlineMegaphone,
  HiOutlinePaperAirplane,
  HiOutlineUserGroup,
} from "react-icons/hi2";

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
        STATUS_STYLES[status] ?? STATUS_STYLES.draft
      }`}
    >
      {status}
    </span>
  );
}

function MetricCard({ label, value, sub, highlight, icon: Icon }) {
  return (
    <div
      className={`${ui.statCard} relative overflow-hidden ${
        highlight ? "border-brand-sage/50 bg-brand-sage/20" : ""
      }`}
    >
      {Icon ? (
        <Icon
          className={`absolute right-3 top-3 h-5 w-5 ${
            highlight ? "text-brand-sage/60" : "text-brand-secondary/40"
          }`}
          aria-hidden
        />
      ) : null}
      <p className={ui.label}>{label}</p>
      <p className={ui.statValue}>{value}</p>
      {sub ? (
        <p className={`text-xs mt-0.5 ${highlight ? "text-brand-stone" : "text-brand-steel"}`}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function Panel({ title, subtitle, count, children, action }) {
  return (
    <section className={`${ui.cardSurface} overflow-hidden flex flex-col`}>
      <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-surface flex items-start justify-between gap-3">
        <div>
          <h2 className={`${ui.titleSm} text-base`}>
            {title}
            {typeof count === "number" ? (
              <span className="ml-2 text-sm font-sans font-normal text-brand-stone">
                ({count})
              </span>
            ) : null}
          </h2>
          {subtitle ? (
            <p className="text-xs text-brand-stone mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionIcon({ type }) {
  if (type === "reply") {
    return (
      <span className={ui.iconReply}>
        <HiOutlineChatBubbleLeftRight className="h-4 w-4" />
      </span>
    );
  }
  if (type === "open") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/20 text-brand-ink">
        <HiOutlineEnvelopeOpen className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className={ui.iconAction}>
      <HiOutlinePaperAirplane className="h-4 w-4" />
    </span>
  );
}

const DOT_STYLES = {
  ok: "bg-brand-sage",
  info: "bg-brand-terracotta/70",
  accent: "bg-brand-gold",
  "": "bg-brand-steel",
};

function FunnelBar({ funnel }) {
  const segments = [
    { key: "pending", label: "Pending", color: "bg-brand-steel/50" },
    { key: "inOutreach", label: "In outreach", color: "bg-brand-terracotta/60" },
    { key: "replied", label: "Replied", color: "bg-brand-gold/70" },
    { key: "qualified", label: "Qualified", color: "bg-brand-sage" },
  ];
  const total = segments.reduce((s, seg) => s + (funnel[seg.key] ?? 0), 0);

  if (total === 0) {
    return (
      <p className="px-4 py-8 text-sm text-brand-stone text-center">
        No prospects enrolled yet. Add contacts to a campaign to see your funnel.
      </p>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex h-3 rounded-full overflow-hidden bg-brand-bg">
        {segments.map((seg) => {
          const count = funnel[seg.key] ?? 0;
          if (!count) return null;
          return (
            <div
              key={seg.key}
              className={`${seg.color} transition-all`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${seg.label}: ${count}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {segments.map((seg) => {
          const count = funnel[seg.key] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={seg.key} className={ui.miniStat}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${seg.color}`} />
                <span className="text-xs text-brand-stone">{seg.label}</span>
              </div>
              <p className="mt-1 text-lg font-semibold text-brand-ink tabular-nums">
                {count}
                <span className="ml-1.5 text-xs font-normal text-brand-steel">{pct}%</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TenantDashboard({ data }) {
  const user = useUser();
  const summary = data?.summary ?? {};
  const funnel = data?.funnel ?? {};
  const tenant = data?.tenant ?? {};
  const tenantId = tenant.id ?? user?.tenantId;

  return (
    <div className={`${ui.page} ${ui.container} max-w-[1400px] space-y-6`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-stone">
            Workspace overview
          </p>
          <h1 className={`${ui.title} mt-1`}>
            {tenant.name ? tenant.name : "Dashboard"}
          </h1>
          <p className={ui.subtitle}>
            Campaign outreach, qualified pipeline, and AE Assist activity in one place.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 shrink-0 lg:w-auto lg:pt-1">
          <Link href="/campaigns" className={ui.btnSecondary}>
            <HiOutlineMegaphone className="h-4 w-4" />
            Campaigns
          </Link>
          <Link href="/assist" className={ui.btnPrimary}>
            <HiOutlineBriefcase className="h-4 w-4" />
            AE Assist
          </Link>
          <DashboardHeaderActions alerts={data?.alerts ?? []} tenantId={tenantId} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard
          label="Active campaigns"
          value={summary.activeCampaigns ?? 0}
          sub={`${summary.totalCampaigns ?? 0} total`}
          icon={HiOutlineMegaphone}
        />
        <MetricCard
          label="Prospects"
          value={summary.totalProspects ?? 0}
          sub="Enrolled across campaigns"
          icon={HiOutlineUserGroup}
        />
        <MetricCard
          label="Replies"
          value={summary.totalReplies ?? 0}
          sub={
            summary.avgReplyRate
              ? `${summary.avgReplyRate}% avg reply rate`
              : "Across all campaigns"
          }
          highlight={(summary.totalReplies ?? 0) > 0}
          icon={HiOutlineChatBubbleLeftRight}
        />
        <MetricCard
          label="Qualified leads"
          value={summary.totalQualified ?? 0}
          sub={
            summary.pendingCrmSync
              ? `${summary.pendingCrmSync} pending CRM sync`
              : "Campaign-qualified"
          }
          highlight={(summary.totalQualified ?? 0) > 0}
          icon={HiOutlineCheckBadge}
        />
        <MetricCard
          label="Open deals"
          value={summary.openDeals ?? 0}
          sub={tenant.hubspotConnected ? "From HubSpot" : "Connect HubSpot"}
          icon={HiOutlineBriefcase}
        />
        <MetricCard
          label="Pipeline"
          value={fmtAmountShort(summary.pipelineValue ?? 0)}
          sub={`${summary.totalSent ?? 0} messages sent`}
          icon={HiOutlineArrowTrendingUp}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <Panel title="Outreach funnel" subtitle="Prospect status across all campaigns">
            <FunnelBar funnel={funnel} />
          </Panel>
        </div>
        <div className="lg:col-span-3">
          <Panel
            title="Campaign health"
            subtitle="Latest campaigns by activity"
            count={data?.campaigns?.length ?? 0}
            action={
              <Link href="/campaigns" className={`${ui.link} text-xs inline-flex items-center gap-1`}>
                View all
                <HiOutlineArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {!data?.campaigns?.length ? (
              <p className="px-4 py-8 text-sm text-brand-stone text-center">
                No campaigns yet.{" "}
                <Link href="/campaigns" className={ui.link}>
                  Create your first campaign
                </Link>
              </p>
            ) : (
              <div className={ui.divider}>
                {data.campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-brand-sage/10 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-brand-ink truncate">{c.name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-xs text-brand-stone mt-0.5">
                        {c.prospects} prospects · {c.sent} sent · {c.qualifiedLeads} qualified
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-brand-ink tabular-nums">
                        {c.replyRate}%
                      </p>
                      <p className="text-xs text-brand-stone">reply rate</p>
                    </div>
                    <HiOutlineArrowRight className="h-4 w-4 text-brand-steel shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Recent replies" subtitle="Prospect responses across campaigns">
          <div className={`${ui.divider} max-h-[400px] overflow-y-auto`}>
            {!data?.recentReplies?.length ? (
              <p className="px-4 py-8 text-sm text-brand-stone text-center">
                No replies yet. Run a campaign to start tracking engagement.
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
                          {reply.company ? (
                            <span className="font-normal text-brand-stone"> · {reply.company}</span>
                          ) : null}
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
        </Panel>

        <Panel title="Recent outreach" subtitle="Messages, opens, and skips">
          <div className={`${ui.divider} max-h-[400px] overflow-y-auto`}>
            {!data?.recentActions?.length ? (
              <p className="px-4 py-8 text-sm text-brand-stone text-center">
                No activity yet. Launch execution on a campaign to see outreach here.
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
                        <p className="text-sm font-medium text-brand-ink">{action.label}</p>
                        <span className="text-xs text-brand-steel shrink-0">
                          {formatRelative(action.at)}
                        </span>
                      </div>
                      <p className="text-xs text-brand-stone mt-0.5">
                        {action.prospectName} · {action.campaignName} · {action.channelLabel}
                      </p>
                      <p className="text-sm text-brand-stone mt-1 line-clamp-2">
                        {action.type === "reply" ? action.responseContent : action.message}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Open deals"
          subtitle="Active pipeline from HubSpot"
          count={data?.deals?.length ?? 0}
          action={
            <Link href="/assist" className={`${ui.link} text-xs inline-flex items-center gap-1`}>
              AE Assist
              <HiOutlineArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {!data?.deals?.length ? (
            <p className="px-4 py-8 text-sm text-brand-stone text-center">
              {tenant.hubspotConnected
                ? "No open deals synced yet. Run a HubSpot sync from AE Assist."
                : "Connect HubSpot to see your deal pipeline here."}
            </p>
          ) : (
            <div className={ui.divider}>
              {data.deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/assist/deal/${deal.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-brand-sage/10 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-brand-ink truncate">{deal.name}</p>
                    <p className="text-xs text-brand-stone mt-0.5 truncate">
                      {deal.company ?? "No account"}
                      {deal.stageLabel ? ` · ${deal.stageLabel}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-brand-ink tabular-nums">
                      {fmtAmountShort(deal.amount)}
                    </p>
                    {deal.score != null ? (
                      <p className="text-xs text-brand-stone">Score {deal.score}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="AE Assist activity" subtitle="Recent team actions and AI workflows">
          <div className={`${ui.divider} max-h-[360px] overflow-y-auto`}>
            {!data?.assistActivity?.length ? (
              <p className="px-4 py-8 text-sm text-brand-stone text-center">
                No assist activity yet. Use AE Assist to draft emails, run insights, and more.
              </p>
            ) : (
              <ul>
                {data.assistActivity.map((a) => (
                  <li key={a.id} className="flex gap-3 px-4 py-2.5">
                    <span className="text-xs text-brand-steel tabular-nums w-14 shrink-0 pt-0.5">
                      {formatRelative(a.createdAt)}
                    </span>
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        DOT_STYLES[actionDot(a.action)] ?? DOT_STYLES[""]
                      }`}
                    />
                    <p className="text-sm text-brand-ink min-w-0">
                      <span className="font-medium">{actionLabel(a.action)}</span>
                      {a.entityType ? (
                        <span className="text-brand-stone"> · {a.entityType}</span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {data?.qualifiedLeads?.length > 0 ? (
        <Panel
          title="Recently qualified"
          subtitle="Prospects marked qualified in campaigns"
          count={data.qualifiedLeads.length}
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {data.qualifiedLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/campaigns/${lead.campaignId}`}
                className={`${ui.miniStat} hover:border-brand-sage/40 hover:bg-brand-sage/5 transition-colors`}
              >
                <p className="text-sm font-medium text-brand-ink truncate">{lead.name}</p>
                {lead.company ? (
                  <p className="text-xs text-brand-stone truncate mt-0.5">{lead.company}</p>
                ) : null}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <p className="text-xs text-brand-stone truncate">{lead.campaignName}</p>
                  {lead.crmSynced ? (
                    <span className={ui.badgeHighlight}>Synced</span>
                  ) : (
                    <span className={ui.badgeQualified}>Pending sync</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      {tenant.memberCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-secondary/25 bg-brand-surface px-4 py-3 text-sm text-brand-stone">
          <span className="inline-flex items-center gap-2">
            <HiOutlineUserGroup className="h-4 w-4 text-brand-secondary" />
            {tenant.memberCount} team member{tenant.memberCount === 1 ? "" : "s"} in this workspace
          </span>
          <Link href="/teams" className={`${ui.link} text-sm inline-flex items-center gap-1`}>
            Manage team
            <HiOutlineArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

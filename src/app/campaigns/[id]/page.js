"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import CampaignActionsModal from "@/components/campaigns/CampaignActionsModal";
import ProspectCommThread from "@/components/campaigns/ProspectCommThread";
import CampaignTemplatesModal from "@/components/campaigns/CampaignTemplatesModal";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlinePlay,
  HiOutlinePause,
  HiOutlinePlus,
  HiOutlineBolt,
  HiOutlineArrowPath,
} from "react-icons/hi2";
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
  if (value == null || Number.isNaN(value)) return "0%";
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

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div
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
      {sub && (
        <p
          className={`text-xs mt-0.5 ${highlight ? "text-emerald-700/80" : "text-gray-400"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function ProgressBar({ percent, label }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900 tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

const Page = () => {
  const params = useParams();
  const id = params?.id;
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const {
    isOpen: templatesModalOpen,
    onOpen: openTemplatesModal,
    onClose: closeTemplatesModal,
  } = useDisclosure();
  const {
    isOpen: prospectDrawerOpen,
    onOpen: openProspectDrawer,
    onClose: closeProspectDrawer,
  } = useDisclosure();
  const [selectedProspect, setSelectedProspect] = useState(null);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) {
        if (res.status === 404) setCampaign(null);
        throw new Error("Failed to load campaign");
      }
      setCampaign(await res.json());
    } catch (err) {
      toast.error(err.message);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchCampaign();
  }, [fetchCampaign]);

  const runAction = async (action) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setCampaign(data);
      toast.success(
        action === "start" ? "Drip campaign started." : "Campaign paused."
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const runNextBestAction = async () => {
    setRunLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "run" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed");
      toast.success(
        data.plannedCount
          ? `Planned ${data.plannedCount} next-best action(s)`
          : "No new actions planned"
      );
      await fetchCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunLoading(false);
    }
  };

  const trackEngagement = async () => {
    setTrackLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tracking failed");
      const updated = data.summary?.updated ?? 0;
      toast.success(
        updated > 0
          ? `Updated ${updated} engagement event(s)`
          : "No new engagement detected"
      );
      await fetchCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTrackLoading(false);
    }
  };

  const filteredProspects =
    campaign?.prospects.filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [p.name, p.company, p.jobTitle, p.email, p.phone]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    }) ?? [];

  if (loading) {
    return (
      <div className="p-5 lg:p-7">
        <p className="text-sm text-gray-500">Loading campaign…</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-5 lg:p-7">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky-800"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          Back to campaigns
        </Link>
        <p className="mt-6 text-sm text-gray-600">Campaign not found.</p>
      </div>
    );
  }

  const { metrics, progress } = campaign;
  const whatsappTemplates = campaign.templates.filter(
    (t) => t.channel === "whatsapp"
  );
  const canStart =
    campaign.status === "draft" || campaign.status === "paused";
  const canPause = campaign.status === "active";
  const isRunning = campaign.status === "active";

  return (
    <div className="p-5 lg:p-7 max-w-[1400px] space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-sky-700"
      >
        <HiOutlineArrowLeft className="h-4 w-4" />
        Campaigns
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {campaign.name}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            {campaign.targetSegment && (
              <span>Segment: {campaign.targetSegment}</span>
            )}
            {campaign.goals && <span>Goals: {campaign.goals}</span>}
            <span>Start: {formatDate(campaign.startDate)}</span>
            <span>Created: {formatDate(campaign.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canPause && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => runAction("pause")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <HiOutlinePause className="h-4 w-4" />
              Pause drip
            </button>
          )}
          {canStart && (
            <button
              type="button"
              disabled={metrics.prospectCount === 0}
              onClick={() => setExecutionModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              <HiOutlinePlay className="h-4 w-4" />
              {campaign.status === "paused"
                ? "Resume drip"
                : "Launch drip campaign"}
            </button>
          )}
          {isRunning && (
            <>
              <button
                type="button"
                disabled={runLoading || metrics.prospectCount === 0}
                onClick={runNextBestAction}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                <HiOutlineBolt className="h-4 w-4" />
                {runLoading ? "Running…" : "Run next-best-action"}
              </button>
              <button
                type="button"
                disabled={trackLoading || metrics.prospectCount === 0}
                onClick={trackEngagement}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <HiOutlineArrowPath className="h-4 w-4" />
                {trackLoading ? "Tracking…" : "Track engagement"}
              </button>
            </>
          )}
          {campaign.status === "completed" && (
            <span className="text-xs text-gray-500 px-2">Campaign completed</span>
          )}
        </div>
      </div>

      {isRunning && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 space-y-1">
          <p>
            Campaign is active. Use Run next-best-action to send outreach and Track
            engagement to sync replies, opens, and connection accepts into comm logs.
          </p>
          {whatsappTemplates.length > 0 ? (
            <p className="text-xs text-emerald-900/90">
              WhatsApp execution uses {whatsappTemplates.length} campaign template
              {whatsappTemplates.length === 1 ? "" : "s"}:{" "}
              {whatsappTemplates.map((t) => t.whatsappTemplateId).join(", ")}.
            </p>
          ) : (
            <p className="text-xs text-amber-800">
              No WhatsApp templates selected — add them via Manage under Comm templates
              before running WhatsApp outreach.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Prospects"
          value={metrics.prospectCount.toLocaleString()}
        />
        <MetricCard
          label="Sent"
          value={metrics.sent.toLocaleString()}
          sub={`of ${metrics.prospectCount} enrolled`}
        />
        <MetricCard
          label="Replies"
          value={metrics.replyCount}
          sub={`${metrics.repliedProspects} prospect${metrics.repliedProspects === 1 ? "" : "s"}`}
          highlight={metrics.replyCount > 0}
        />
        <MetricCard
          label="Reply rate"
          value={formatPercent(metrics.replyRate)}
          sub={
            metrics.sent > 0
              ? "of contacted prospects"
              : "No outreach sent yet"
          }
          highlight={metrics.replyRate > 0}
        />
        <MetricCard label="Open rate" value={formatPercent(metrics.openRate)} />
        <MetricCard label="Qualified" value={metrics.qualifiedLeads} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Progress</h2>
          <ProgressBar label="Outreach sent" percent={progress.sentPercent} />
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Templates</p>
              <p className="text-sm font-semibold text-gray-900">
                {progress.templateCount}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Max stage</p>
              <p className="text-sm font-semibold text-gray-900">
                {progress.maxStage || "—"}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Channels</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {progress.channelsConfigured.length
                  ? progress.channelsConfigured.join(", ")
                  : "None"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {["draft", "active", "paused", "completed"].map((s) => (
              <span
                key={s}
                className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${
                  campaign.status === s
                    ? "bg-sky-100 text-sky-800 font-medium"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Comm templates
            </h2>
            <button
              type="button"
              onClick={openTemplatesModal}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              Manage
            </button>
          </div>
          {campaign.templates.length === 0 ? (
            <p className="text-xs text-gray-500">No templates configured yet.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {campaign.templates.map((t) => (
                <li
                  key={t.id}
                  className="text-xs border-b border-gray-50 pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-gray-800">
                    {t.channelLabel} · S{t.stage}
                  </span>
                  {t.channel === "whatsapp" && t.whatsappTemplateId && (
                    <p className="text-gray-600 truncate mt-0.5">
                      {t.whatsappTemplateId}
                    </p>
                  )}
                  {t.subject && (
                    <p className="text-gray-500 truncate">{t.subject}</p>
                  )}
                  {t.channel !== "whatsapp" && (
                    <p className="text-gray-400">{t.ctaLabel}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50/80">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Prospects ({campaign.prospects.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Click a prospect to view details and conversations (drawer)
            </p>
          </div>
          <input
            type="search"
            placeholder="Search name, company, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm rounded-lg border border-gray-300 px-3 py-1.5 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Company
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Job title
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Email
                </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Msgs
                </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Reply
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProspects.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    {search ? "No prospects match your search." : "No prospects."}
                  </td>
                </tr>
              ) : (
                filteredProspects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => {
                      setSelectedProspect(p);
                      openProspectDrawer();
                    }}
                    className="cursor-pointer transition-colors hover:bg-gray-50/80"
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {p.company || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {p.jobTitle || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {p.email ? (
                        <a
                          href={`mailto:${p.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sky-700 hover:underline"
                        >
                          {p.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-600 tabular-nums">
                      {p.messageCount}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.hasReply ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        placement="right"
        size="md"
        isOpen={prospectDrawerOpen}
        onClose={() => {
          closeProspectDrawer();
          setSelectedProspect(null);
        }}
      >
        <DrawerOverlay />
        <DrawerContent className="!max-w-[520px]">
          <DrawerCloseButton />
          <DrawerHeader className="text-sm font-semibold text-gray-900">
            {selectedProspect?.name ?? "Prospect"}
          </DrawerHeader>

          <DrawerBody className="px-4 pb-6">
            {!selectedProspect ? (
              <p className="text-sm text-gray-500">No prospect selected.</p>
            ) : (
              <div className="space-y-5">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {selectedProspect.company || "—"}
                      </p>
                      <p className="text-xs mt-1 text-gray-500 truncate">
                        {selectedProspect.jobTitle || "—"}
                      </p>
                    </div>
                    <div className="text-xs text-gray-600 text-right whitespace-nowrap">
                      <p className="font-medium text-gray-900">{selectedProspect.messageCount} msgs</p>
                      <p className="mt-1">
                        {selectedProspect.hasReply ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Reply received
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No reply yet</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600">
                    <p className="truncate">
                      <span className="font-medium text-gray-700">Email:</span>{" "}
                      {selectedProspect.email ? (
                        <a
                          href={`mailto:${selectedProspect.email}`}
                          className="text-sky-700 hover:underline"
                        >
                          {selectedProspect.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-gray-700">Phone:</span>{" "}
                      {selectedProspect.phone || "—"}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-gray-700">WhatsApp:</span>{" "}
                      {selectedProspect.whatsapp || "—"}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-gray-700">LinkedIn:</span>{" "}
                      {selectedProspect.linkedinUrl ? (
                        <a
                          href={selectedProspect.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 hover:underline"
                        >
                          Profile
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Conversations
                  </p>
                  <ProspectCommThread
                    communications={selectedProspect.communications}
                  />
                </div>
              </div>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <CampaignTemplatesModal
        isOpen={templatesModalOpen}
        onClose={closeTemplatesModal}
        campaignId={campaign.id}
        templates={campaign.templates}
        onUpdated={setCampaign}
      />

      <CampaignActionsModal
        isOpen={executionModalOpen}
        onClose={() => setExecutionModalOpen(false)}
        campaignId={campaign.id}
        campaignName={campaign.name}
        campaignStatus={campaign.status}
        prospects={campaign.prospects}
        templates={campaign.templates}
        onCampaignUpdate={(data) => {
          setCampaign(data);
          fetchCampaign();
        }}
      />
    </div>
  );
};

export default DashboardLayout()(Page);

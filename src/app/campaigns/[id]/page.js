"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import CampaignActionsModal from "@/components/campaigns/CampaignActionsModal";
import ProspectCommThread from "@/components/campaigns/ProspectCommThread";
import CampaignTemplatesModal from "@/components/campaigns/CampaignTemplatesModal";
import CampaignCommLogsDrawer from "@/components/campaigns/CampaignCommLogsDrawer";
import AddProspectModal from "@/components/campaigns/AddProspectModal";
import ConfirmBox from "@/components/dialog/ConfirmBox";
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
  HiOutlineClipboardDocumentList,
  HiOutlineTrash,
} from "react-icons/hi2";
import { STATUS_STYLES, ui } from "@/lib/brandUi";
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
      className={`${ui.statCard} ${
        highlight ? "border-brand-sage/50 bg-brand-sage/25" : ""
      }`}
    >
      <p className={ui.label}>{label}</p>
      <p className={ui.statValue}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-0.5 ${highlight ? "text-brand-stone" : "text-brand-steel"}`}>
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
        <span className="text-brand-stone">{label}</span>
        <span className="font-medium text-brand-dark tabular-nums">{percent}%</span>
      </div>
      <div className={ui.progressTrack}>
        <div className={ui.progressBar} style={{ width: `${percent}%` }} />
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
  const {
    isOpen: activityDrawerOpen,
    onOpen: openActivityDrawer,
    onClose: closeActivityDrawer,
  } = useDisclosure();
  const {
    isOpen: addProspectModalOpen,
    onOpen: openAddProspectModal,
    onClose: closeAddProspectModal,
  } = useDisclosure();
  const {
    isOpen: deleteProspectConfirmOpen,
    onOpen: openDeleteProspectConfirm,
    onClose: closeDeleteProspectConfirm,
  } = useDisclosure();
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [deleteProspectLoading, setDeleteProspectLoading] = useState(false);
  const [calendlyUrlEdit, setCalendlyUrlEdit] = useState("");
  const [savingCalendlyUrl, setSavingCalendlyUrl] = useState(false);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) {
        if (res.status === 404) setCampaign(null);
        throw new Error("Failed to load campaign");
      }
      const data = await res.json();
      setCampaign(data);
      setCalendlyUrlEdit(data.calendlyBookingUrl ?? "");
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

  const saveCalendlyUrl = async () => {
    setSavingCalendlyUrl(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendlyBookingUrl: calendlyUrlEdit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setCampaign(data);
      setCalendlyUrlEdit(data.calendlyBookingUrl ?? "");
      toast.success("Calendly URL saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCalendlyUrl(false);
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

  const deleteProspect = async () => {
    if (!selectedProspect || !id) return;
    setDeleteProspectLoading(true);
    try {
      const res = await fetch(
        `/api/campaigns/${id}/prospects/${selectedProspect.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete prospect");
      setCampaign(data);
      toast.success("Prospect removed.");
      closeProspectDrawer();
      setSelectedProspect(null);
      closeDeleteProspectConfirm();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteProspectLoading(false);
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
      <div className={`${ui.page} ${ui.container}`}>
        <p className={ui.body}>Loading campaign…</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className={`${ui.page} ${ui.container}`}>
        <Link href="/campaigns" className={`inline-flex items-center gap-1 ${ui.link}`}>
          <HiOutlineArrowLeft className="h-4 w-4" />
          Back to campaigns
        </Link>
        <p className="mt-6 text-sm text-brand-stone">Campaign not found.</p>
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
    <div className={`${ui.page} ${ui.container} space-y-6`}>
      <Link href="/campaigns" className={`inline-flex items-center gap-1 ${ui.link}`}>
        <HiOutlineArrowLeft className="h-4 w-4" />
        Campaigns
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className={`${ui.titleSm} truncate`}>{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="text-sm text-brand-stone mt-1">{campaign.description}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-brand-stone">
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
              className={`${ui.btnSecondarySurface} disabled:opacity-50`}
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
              className={`${ui.btnPrimary} disabled:opacity-50`}
            >
              <HiOutlinePlay className="h-4 w-4" />
              {campaign.status === "paused"
                ? "Resume drip"
                : "Launch drip campaign"}
            </button>
          )}
          <button
            type="button"
            onClick={openActivityDrawer}
            className={ui.btnSecondarySurface}
          >
            <HiOutlineClipboardDocumentList className="h-4 w-4" />
            Activity log
          </button>
          {isRunning && (
            <>
              <button
                type="button"
                disabled={runLoading || metrics.prospectCount === 0}
                onClick={runNextBestAction}
                className={`${ui.btnPrimary} disabled:opacity-50`}
              >
                <HiOutlineBolt className="h-4 w-4" />
                {runLoading ? "Running…" : "Run next-best-action"}
              </button>
              <button
                type="button"
                disabled={trackLoading || metrics.prospectCount === 0}
                onClick={trackEngagement}
                className={`${ui.btnSecondarySurface} disabled:opacity-50`}
              >
                <HiOutlineArrowPath className="h-4 w-4" />
                {trackLoading ? "Tracking…" : "Track engagement"}
              </button>
            </>
          )}
          {campaign.status === "completed" && (
            <span className="text-xs text-brand-stone px-2">Campaign completed</span>
          )}
        </div>
      </div>

      {campaign.calendlyConnected === false && (
        <div className={ui.alertWarn}>
          Connect Calendly in{" "}
          <Link href="/settings" className="font-medium underline text-brand-ink">
            Settings
          </Link>{" "}
          to auto-qualify prospects when meetings are booked.
        </div>
      )}

      <div className={`${ui.cardSurface} px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3`}>
        <div className="flex-1 min-w-0">
          <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
            Calendly booking URL
          </label>
          <input
            type="url"
            value={calendlyUrlEdit}
            onChange={(e) => setCalendlyUrlEdit(e.target.value)}
            placeholder="https://calendly.com/…"
            className={ui.inputSurface}
          />
        </div>
        <button
          type="button"
          disabled={savingCalendlyUrl}
          onClick={saveCalendlyUrl}
          className={`shrink-0 ${ui.btnPrimary} disabled:opacity-50`}
        >
          {savingCalendlyUrl ? "Saving…" : "Save URL"}
        </button>
      </div>

      {isRunning && (
        <div className={`${ui.alertInfo} space-y-1`}>
          <p>
            Campaign is active. Use Run next-best-action to send outreach and Track
            engagement to sync replies, opens, and connection accepts into comm logs.
          </p>
          {whatsappTemplates.length > 0 ? (
            <p className="text-xs text-brand-stone">
              WhatsApp execution uses {whatsappTemplates.length} campaign template
              {whatsappTemplates.length === 1 ? "" : "s"}:{" "}
              {whatsappTemplates.map((t) => t.whatsappTemplateId).join(", ")}.
            </p>
          ) : (
            <p className="text-xs text-brand-ink/80">
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
        <div className={`lg:col-span-2 ${ui.cardSurface} p-4 space-y-4`}>
          <h2 className={`${ui.titleSm} text-base`}>Progress</h2>
          <ProgressBar label="Outreach sent" percent={progress.sentPercent} />
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <div className={ui.miniStat}>
              <p className="text-xs text-brand-stone">Templates</p>
              <p className="text-sm font-semibold text-brand-dark tabular-nums">
                {progress.templateCount}
              </p>
            </div>
            <div className={ui.miniStat}>
              <p className="text-xs text-brand-stone">Max stage</p>
              <p className="text-sm font-semibold text-brand-dark tabular-nums">
                {progress.maxStage || "—"}
              </p>
            </div>
            <div className={ui.miniStat}>
              <p className="text-xs text-brand-stone">Channels</p>
              <p className="text-sm font-semibold text-brand-dark truncate">
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
                    ? "bg-brand-sage/30 text-brand-ink font-medium"
                    : "bg-brand-bg text-brand-steel"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className={`${ui.cardSurface} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`${ui.titleSm} text-base`}>Comm templates</h2>
            <button
              type="button"
              onClick={openTemplatesModal}
              className={`${ui.btnSecondarySurface} px-2 py-1 text-xs`}
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              Manage
            </button>
          </div>
          {campaign.templates.length === 0 ? (
            <p className="text-xs text-brand-stone">No templates configured yet.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {campaign.templates.map((t) => (
                <li
                  key={t.id}
                  className="text-xs border-b border-brand-secondary/15 pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-brand-ink">
                    {t.channelLabel} · S{t.stage}
                  </span>
                  {t.channel === "whatsapp" && t.whatsappTemplateId && (
                    <p className="text-brand-stone truncate mt-0.5">
                      {t.whatsappTemplateId}
                    </p>
                  )}
                  {t.subject && (
                    <p className="text-brand-stone truncate">{t.subject}</p>
                  )}
                  {t.channel !== "whatsapp" && (
                    <p className="text-brand-steel">{t.ctaLabel}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={ui.tableWrap}>
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 ${ui.tableToolbar}`}>
          <div>
            <h2 className={`${ui.titleSm} text-base`}>
              Prospects ({campaign.prospects.length})
            </h2>
            <p className="text-xs text-brand-stone mt-0.5">
              Click a prospect to view details and conversations (drawer)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openAddProspectModal}
              className={ui.btnSecondarySurface}
            >
              <HiOutlinePlus className="h-4 w-4" />
              Add prospect
            </button>
            <input
              type="search"
              placeholder="Search name, company, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${ui.inputSurface} sm:w-64`}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className={ui.tableHead}>
                <th className={`${ui.tableHeadCell} py-2.5`}>Name</th>
                <th className={`${ui.tableHeadCell} py-2.5`}>Company</th>
                <th className={`${ui.tableHeadCell} py-2.5`}>Job title</th>
                <th className={`${ui.tableHeadCell} py-2.5`}>Email</th>
                <th className={`${ui.tableHeadCell} text-center py-2.5`}>Msgs</th>
                <th className={`${ui.tableHeadCell} text-center py-2.5`}>Reply</th>
                <th className={`${ui.tableHeadCell} text-center py-2.5`}>Qualified</th>
              </tr>
            </thead>
            <tbody className={ui.divider}>
              {filteredProspects.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-brand-stone"
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
                    className={`${ui.tableRowHover} hover:bg-brand-sage/10`}
                  >
                    <td className="px-4 py-2.5 font-medium text-brand-ink whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5 text-brand-stone">
                      {p.company || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-brand-stone">
                      {p.jobTitle || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-brand-stone">
                      {p.email ? (
                        <a
                          href={`mailto:${p.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-brand-terracotta hover:underline"
                        >
                          {p.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-brand-stone tabular-nums">
                      {p.messageCount}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.hasReply ? (
                        <span className={ui.badgeHighlight}>Yes</span>
                      ) : (
                        <span className="text-xs text-brand-steel">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.isQualified ? (
                        <span
                          className={ui.badgeQualified}
                          title={p.qualifiedReason ?? ""}
                        >
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-brand-steel">—</span>
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
        <DrawerContent className="!max-w-[520px] !bg-brand-surface">
          <DrawerCloseButton />
          <DrawerHeader className={`${ui.titleSm} text-base !bg-brand-surface`}>
            {selectedProspect?.name ?? "Prospect"}
          </DrawerHeader>

          <DrawerBody className="px-4 pb-6 !bg-brand-surface">
            {!selectedProspect ? (
              <p className={ui.body}>No prospect selected.</p>
            ) : (
              <div className="space-y-5">
                <div className={`${ui.cardSurface} p-4`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-ink truncate">
                        {selectedProspect.company || "—"}
                      </p>
                      <p className="text-xs mt-1 text-brand-stone truncate">
                        {selectedProspect.jobTitle || "—"}
                      </p>
                    </div>
                    <div className="text-xs text-brand-stone text-right whitespace-nowrap">
                      <p className="font-medium text-brand-ink">{selectedProspect.messageCount} msgs</p>
                      <p className="mt-1">
                        {selectedProspect.isQualified ? (
                          <span className={ui.badgeQualified}>Qualified</span>
                        ) : selectedProspect.hasReply ? (
                          <span className={ui.badgeHighlight}>Reply received</span>
                        ) : (
                          <span className="text-xs text-brand-steel">No reply yet</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-brand-stone">
                    <p className="truncate">
                      <span className="font-medium text-brand-ink">Email:</span>{" "}
                      {selectedProspect.email ? (
                        <a
                          href={`mailto:${selectedProspect.email}`}
                          className="text-brand-terracotta hover:underline"
                        >
                          {selectedProspect.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-brand-ink">Phone:</span>{" "}
                      {selectedProspect.phone || "—"}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-brand-ink">WhatsApp:</span>{" "}
                      {selectedProspect.whatsapp || "—"}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-brand-ink">LinkedIn:</span>{" "}
                      {selectedProspect.linkedinUrl ? (
                        <a
                          href={selectedProspect.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-terracotta hover:underline"
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
                  <p className={ui.label}>Conversations</p>
                  <ProspectCommThread
                    communications={selectedProspect.communications}
                  />
                </div>

                <div className="pt-2 border-t border-brand-secondary/25">
                  <button
                    type="button"
                    onClick={openDeleteProspectConfirm}
                    disabled={deleteProspectLoading}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
                  >
                    <HiOutlineTrash className="h-4 w-4" />
                    Delete prospect
                  </button>
                </div>
              </div>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <AddProspectModal
        isOpen={addProspectModalOpen}
        onClose={closeAddProspectModal}
        campaignId={campaign.id}
        onAdded={setCampaign}
      />

      <ConfirmBox
        isOpen={deleteProspectConfirmOpen}
        onClose={closeDeleteProspectConfirm}
        action="Delete prospect"
        handler={deleteProspect}
      />

      <CampaignTemplatesModal
        isOpen={templatesModalOpen}
        onClose={closeTemplatesModal}
        campaignId={campaign.id}
        templates={campaign.templates}
        onUpdated={setCampaign}
      />

      <CampaignCommLogsDrawer
        isOpen={activityDrawerOpen}
        onClose={closeActivityDrawer}
        commLogs={campaign.commLogs ?? []}
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

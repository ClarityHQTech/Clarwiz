"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import CampaignActionsModal from "@/components/campaigns/CampaignActionsModal";
import CampaignCopilotRunner from "@/components/campaigns/CampaignCopilotRunner";
import ContactCommThread from "@/components/campaigns/ContactCommThread";
import CampaignTemplatesModal from "@/components/campaigns/CampaignTemplatesModal";
import CampaignCommLogsDrawer from "@/components/campaigns/CampaignCommLogsDrawer";
import AddContactModal from "@/components/campaigns/AddContactModal";
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
  const [outreachTzEdit, setOutreachTzEdit] = useState("UTC");
  const [defaultOutreachTimeEdit, setDefaultOutreachTimeEdit] = useState("11:00");
  const [savingOutreachSchedule, setSavingOutreachSchedule] = useState(false);
  const [prospectDeliveryTime, setProspectDeliveryTime] = useState("");
  const [savingProspectTime, setSavingProspectTime] = useState(false);

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
      setOutreachTzEdit(data.outreachTimezone ?? "UTC");
      setDefaultOutreachTimeEdit(data.defaultOutreachTime ?? "11:00");
    } catch (err) {
      toast.error(err.message);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (selectedProspect) {
      setProspectDeliveryTime(
        selectedProspect.outreachDeliveryTime ||
          campaign?.defaultOutreachTime ||
          "11:00"
      );
    }
  }, [selectedProspect, campaign?.defaultOutreachTime]);

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
        `/api/campaigns/${id}/contact-campaigns/${selectedProspect.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete prospect");
      setCampaign(data);
      toast.success("Contact removed from campaign.");
      closeProspectDrawer();
      setSelectedProspect(null);
      closeDeleteProspectConfirm();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteProspectLoading(false);
    }
  };

  const contactList = campaign?.contacts ?? campaign?.prospects ?? [];

  const filteredContacts = contactList.filter((p) => {
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
  const isAutopilot = campaign.status === "active";
  const isCopilot =
    campaign.status === "draft" || campaign.status === "paused";

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
          {isCopilot && metrics.prospectCount > 0 && (
            <>
              <button
                type="button"
                disabled={runLoading}
                onClick={runNextBestAction}
                className={`${ui.btnSecondarySurface} disabled:opacity-50`}
              >
                <HiOutlineBolt className="h-4 w-4" />
                {runLoading ? "Running…" : "Run outreach (all)"}
              </button>
              <button
                type="button"
                disabled={trackLoading}
                onClick={trackEngagement}
                className={`${ui.btnSecondarySurface} disabled:opacity-50`}
              >
                <HiOutlineArrowPath className="h-4 w-4" />
                {trackLoading ? "Tracking…" : "Track (all)"}
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
          <Link href="/integrations" className="font-medium underline text-brand-ink">
            Integrations
          </Link>{" "}
          to auto-qualify prospects when meetings are booked.
        </div>
      )}

      {isCopilot && (
        <CampaignCopilotRunner
          campaignId={id}
          prospects={contactList}
          onComplete={fetchCampaign}
        />
      )}

      <div className={`${ui.cardSurface} px-4 py-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3`}>
        <div>
          <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
            Outreach timezone
          </label>
          <input
            type="text"
            value={outreachTzEdit}
            onChange={(e) => setOutreachTzEdit(e.target.value)}
            placeholder="America/New_York"
            className={ui.inputSurface}
          />
        </div>
        <div>
          <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
            Default send time
          </label>
          <input
            type="time"
            value={defaultOutreachTimeEdit}
            onChange={(e) => setDefaultOutreachTimeEdit(e.target.value)}
            className={ui.inputSurface}
          />
        </div>
        <div className="sm:col-span-2 flex items-end">
          <button
            type="button"
            disabled={savingOutreachSchedule}
            onClick={async () => {
              setSavingOutreachSchedule(true);
              try {
                const res = await fetch(`/api/campaigns/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    outreachTimezone: outreachTzEdit,
                    defaultOutreachTime: defaultOutreachTimeEdit,
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Save failed");
                setCampaign(data);
                toast.success("Outreach schedule saved");
              } catch (err) {
                toast.error(err.message);
              } finally {
                setSavingOutreachSchedule(false);
              }
            }}
            className={`${ui.btnPrimary} disabled:opacity-50`}
          >
            {savingOutreachSchedule ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>

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

      {isAutopilot && (
        <div className={`${ui.alertInfo} space-y-1`}>
          <p>
            Autopilot is on. Outreach runs once per prospect per day at the scheduled
            time (default {campaign.defaultOutreachTime ?? "11:00"}{" "}
            {campaign.outreachTimezone ?? "UTC"}). Tracking is via webhooks — configure
            them in{" "}
            <Link href="/integrations" className="font-medium underline text-brand-ink">
              Integrations
            </Link>
            .
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
          label="Contacts"
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
              Contacts ({contactList.length})
            </h2>
            <p className="text-xs text-brand-stone mt-0.5">
              Click a contact to view details and conversations (drawer)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openAddProspectModal}
              className={ui.btnSecondarySurface}
            >
              <HiOutlinePlus className="h-4 w-4" />
              Add contact
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
                <th className={`${ui.tableHeadCell} text-center py-2.5`}>Status</th>
              </tr>
            </thead>
            <tbody className={ui.divider}>
              {filteredContacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-brand-stone"
                  >
                    {search ? "No contacts match your search." : "No contacts."}
                  </td>
                </tr>
              ) : (
                filteredContacts.map((p) => (
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
                      <span
                        className={
                          p.status === "QUALIFIED"
                            ? ui.badgeQualified
                            : p.status === "REPLIED" || p.status === "IN_OUTREACH"
                              ? ui.badgeHighlight
                              : p.status === "DISQUALIFIED"
                                ? "text-xs font-medium text-red-700"
                                : "text-xs text-brand-steel"
                        }
                        title={p.qualifiedReason ?? p.statusLabel ?? ""}
                      >
                        {p.statusLabel ?? p.status ?? "—"}
                      </span>
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
            {selectedProspect?.name ?? "Contact"}
          </DrawerHeader>

          <DrawerBody className="px-4 pb-6 !bg-brand-surface">
            {!selectedProspect ? (
              <p className={ui.body}>No contact selected.</p>
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
                        <span
                          className={
                            selectedProspect.status === "QUALIFIED"
                              ? ui.badgeQualified
                              : selectedProspect.status === "REPLIED" ||
                                  selectedProspect.status === "IN_OUTREACH"
                                ? ui.badgeHighlight
                                : "text-xs text-brand-steel"
                          }
                        >
                          {selectedProspect.statusLabel ?? selectedProspect.status}
                        </span>
                        {selectedProspect.personaLabel && (
                          <span className="block text-xs text-brand-stone mt-1">
                            {selectedProspect.personaLabel}
                          </span>
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

                  <div className="mt-4 pt-4 border-t border-brand-sand/50">
                    <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
                      Delivery time (override)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={prospectDeliveryTime}
                        onChange={(e) => setProspectDeliveryTime(e.target.value)}
                        className={`flex-1 ${ui.inputSurface}`}
                      />
                      <button
                        type="button"
                        disabled={savingProspectTime}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSavingProspectTime(true);
                          try {
                            const res = await fetch(
                              `/api/campaigns/${id}/contact-campaigns/${selectedProspect.id}`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  outreachDeliveryTime: prospectDeliveryTime,
                                }),
                              }
                            );
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Save failed");
                            setCampaign(data);
                            const rows = data.contacts ?? data.prospects ?? [];
                            const updated = rows.find(
                              (p) => p.id === selectedProspect.id
                            );
                            if (updated) setSelectedProspect(updated);
                            toast.success("Delivery time saved");
                          } catch (err) {
                            toast.error(err.message);
                          } finally {
                            setSavingProspectTime(false);
                          }
                        }}
                        className={`shrink-0 ${ui.btnSecondarySurface} disabled:opacity-50`}
                      >
                        {savingProspectTime ? "…" : "Save"}
                      </button>
                    </div>
                    {selectedProspect.nextScheduledOutreachAt && (
                      <p className="text-xs text-brand-stone mt-1">
                        Next scheduled:{" "}
                        {new Date(
                          selectedProspect.nextScheduledOutreachAt
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={ui.label}>Conversations</p>
                  <ContactCommThread
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
                    Remove from campaign
                  </button>
                </div>
              </div>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <AddContactModal
        isOpen={addProspectModalOpen}
        onClose={closeAddProspectModal}
        campaignId={campaign.id}
        onAdded={setCampaign}
      />

      <ConfirmBox
        isOpen={deleteProspectConfirmOpen}
        onClose={closeDeleteProspectConfirm}
        action="Remove contact from campaign"
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
          prospects={contactList}
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

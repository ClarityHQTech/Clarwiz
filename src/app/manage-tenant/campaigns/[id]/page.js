"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import CampaignActionsModal from "@/components/campaigns/CampaignActionsModal";
import CampaignTemplatesModal from "@/components/campaigns/CampaignTemplatesModal";
import CampaignCommLogsDrawer from "@/components/campaigns/CampaignCommLogsDrawer";
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
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlinePlay,
  HiOutlinePause,
  HiOutlinePlus,
  HiOutlineBolt,
  HiOutlineArrowPath,
  HiOutlineClipboardDocumentList,
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

const Page = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id;
  const tenantId = searchParams.get("tenantId");

  const [contextReady, setContextReady] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [calendlyUrlEdit, setCalendlyUrlEdit] = useState("");
  const [savingCalendlyUrl, setSavingCalendlyUrl] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);

  const {
    isOpen: templatesModalOpen,
    onOpen: openTemplatesModal,
    onClose: closeTemplatesModal,
  } = useDisclosure();
  const {
    isOpen: activityDrawerOpen,
    onOpen: openActivityDrawer,
    onClose: closeActivityDrawer,
  } = useDisclosure();
  const {
    isOpen: prospectDrawerOpen,
    onOpen: openProspectDrawer,
    onClose: closeProspectDrawer,
  } = useDisclosure();

  useEffect(() => {
    const prepare = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/tenant/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to activate tenant");
        }
        setContextReady(true);
      } catch (err) {
        toast.error(err.message || "Failed to initialize tenant context");
        setContextReady(false);
      }
    };
    prepare();
  }, [tenantId]);

  const fetchCampaign = useCallback(async () => {
    if (!id || !contextReady) return;
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
  }, [id, contextReady]);

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
      toast.success(action === "start" ? "Drip campaign started." : "Campaign paused.");
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
        data.plannedCount ? `Planned ${data.plannedCount} next-best action(s)` : "No new actions planned"
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
      toast.success(updated > 0 ? `Updated ${updated} engagement event(s)` : "No new engagement detected");
      await fetchCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTrackLoading(false);
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
      toast.success("Calendly URL saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCalendlyUrl(false);
    }
  };

  if (loading) {
    return <div className="p-5 lg:p-7 text-sm text-gray-500">Loading campaign...</div>;
  }

  if (!campaign) {
    return (
      <div className="p-5 lg:p-7 space-y-4">
        <Link
          href={`/manage-tenant/campaigns?tenantId=${tenantId || ""}`}
          className="inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky-800"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          Back to admin campaigns
        </Link>
        <p className="text-sm text-gray-600">Campaign not found.</p>
      </div>
    );
  }

  const { metrics } = campaign;
  const canStart = campaign.status === "draft" || campaign.status === "paused";
  const canPause = campaign.status === "active";
  const isRunning = campaign.status === "active";

  return (
    <div className="p-5 lg:p-7 max-w-[1400px] space-y-6">
      <Link
        href={`/manage-tenant/campaigns?tenantId=${tenantId || ""}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-sky-700"
      >
        <HiOutlineArrowLeft className="h-4 w-4" />
        Admin campaigns
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-gray-900">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {campaign.description || "Manage campaign execution, templates, and prospects."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {canPause ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => runAction("pause")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <HiOutlinePause className="h-4 w-4" />
              Pause drip
            </button>
          ) : null}
          {canStart ? (
            <button
              type="button"
              disabled={metrics.prospectCount === 0}
              onClick={() => setExecutionModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              <HiOutlinePlay className="h-4 w-4" />
              {campaign.status === "paused" ? "Resume drip" : "Launch drip campaign"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openActivityDrawer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <HiOutlineClipboardDocumentList className="h-4 w-4" />
            Activity log
          </button>
          {isRunning ? (
            <>
              <button
                type="button"
                disabled={runLoading || metrics.prospectCount === 0}
                onClick={runNextBestAction}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                <HiOutlineBolt className="h-4 w-4" />
                {runLoading ? "Running..." : "Run next-best-action"}
              </button>
              <button
                type="button"
                disabled={trackLoading || metrics.prospectCount === 0}
                onClick={trackEngagement}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <HiOutlineArrowPath className="h-4 w-4" />
                {trackLoading ? "Tracking..." : "Track engagement"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Calendly booking URL
          </label>
          <input
            type="url"
            value={calendlyUrlEdit}
            onChange={(e) => setCalendlyUrlEdit(e.target.value)}
            placeholder="https://calendly.com/..."
            className="w-full text-sm rounded-lg border border-gray-300 px-3 py-1.5"
          />
        </div>
        <button
          type="button"
          disabled={savingCalendlyUrl}
          onClick={saveCalendlyUrl}
          className="shrink-0 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        >
          {savingCalendlyUrl ? "Saving..." : "Save URL"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Prospects</p>
          <p className="text-xl font-semibold text-gray-900">{metrics.prospectCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Sent</p>
          <p className="text-xl font-semibold text-gray-900">{metrics.sent}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Reply rate</p>
          <p className="text-xl font-semibold text-gray-900">{formatPercent(metrics.replyRate)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Qualified</p>
          <p className="text-xl font-semibold text-gray-900">{metrics.qualifiedLeads}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/80">
            <h2 className="text-sm font-semibold text-gray-900">
              Prospects ({campaign.prospects.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-white">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                    Company
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                    Email
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                    Msgs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaign.prospects.map((prospect) => (
                  <tr
                    key={prospect.id}
                    onClick={() => {
                      setSelectedProspect(prospect);
                      openProspectDrawer();
                    }}
                    className="cursor-pointer hover:bg-gray-50/80"
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900">{prospect.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{prospect.company || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{prospect.email || "-"}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">
                      {prospect.messageCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Comm templates</h2>
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
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {campaign.templates.map((template) => (
                <li key={template.id} className="text-xs border-b border-gray-50 pb-2 last:border-0">
                  <span className="font-medium text-gray-800">
                    {template.channelLabel} · S{template.stage}
                  </span>
                  {template.subject ? (
                    <p className="text-gray-500 truncate">{template.subject}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
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
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>{selectedProspect?.name || "Prospect"}</DrawerHeader>
          <DrawerBody>
            {selectedProspect ? (
              <div className="text-sm space-y-2">
                <p>Email: {selectedProspect.email || "-"}</p>
                <p>Company: {selectedProspect.company || "-"}</p>
                <p>Job title: {selectedProspect.jobTitle || "-"}</p>
                <p>Created: {formatDate(selectedProspect.createdAt)}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No prospect selected.</p>
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

export default AdminLayout()(Page);

"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineBolt,
} from "react-icons/hi2";
import { toast } from "sonner";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { ResultCard } from "@/components/campaigns/executionResultCard";

export default function CampaignActionsModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  campaignStatus,
  prospects,
  templates = [],
  onCampaignUpdate,
  onRunExecution,
  onTrackEngagement,
}) {
  const whatsappTemplates = templates.filter((t) => t.channel === "whatsapp");
  const [running, setRunning] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [results, setResults] = useState([]);
  const [trackResults, setTrackResults] = useState([]);
  const [commLogs, setCommLogs] = useState([]);

  const refreshCampaign = useCallback(async () => {
    if (!onCampaignUpdate) return;
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (res.ok) onCampaignUpdate(await res.json());
  }, [campaignId, onCampaignUpdate]);

  const runExecution = async () => {
    if (onRunExecution) {
      await onRunExecution();
      return;
    }
    setRunning(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "run" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed");
      setResults(data.results ?? []);
      setCommLogs(data.commLogs ?? []);
      toast.success(
        data.plannedCount
          ? `Planned ${data.plannedCount} next-best action(s)`
          : "No new actions planned"
      );
      await refreshCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  const trackEngagement = async () => {
    if (onTrackEngagement) {
      await onTrackEngagement();
      return;
    }
    setTracking(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tracking failed");
      setTrackResults(data.results ?? []);
      setCommLogs(data.commLogs ?? []);
      const updated = data.summary?.updated ?? 0;
      toast.success(
        updated > 0
          ? `Updated ${updated} engagement event(s) across channels`
          : "No new engagement detected"
      );
      await refreshCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTracking(false);
    }
  };

  const startCampaign = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start campaign");
      onCampaignUpdate?.(data);
      toast.success("Campaign is active — run next-best-action when ready");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  };

  const needsActivate =
    campaignStatus === "draft" || campaignStatus === "paused";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader className="text-base font-semibold text-gray-900 pr-10">
          Campaign actions — {campaignName}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody className="space-y-5">
          <p className="text-sm text-gray-600">
            Run the next-best-action engine using comm history, live signals, and
            tenant ICP context. Outbound messages are sent via your connected
            channels (Smartlead, LinkedIn, WhatsApp). Track engagement to sync
            opens, replies, and connection accepts back into comm logs.
          </p>

          {whatsappTemplates.length > 0 ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-900">
              <p className="font-medium">WhatsApp templates for this campaign</p>
              <ul className="mt-1 space-y-0.5 list-disc list-inside text-emerald-800/90">
                {whatsappTemplates.map((t) => (
                  <li key={t.id}>
                    S{t.stage}: {t.whatsappTemplateId}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-emerald-800/80">
                Execution only sends templates selected above — not your full
                provider catalog.
              </p>
            </div>
          ) : (
            <p className="text-xs text-amber-800 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              No WhatsApp templates linked to this campaign. Add them from Comm
              templates → Manage before WhatsApp steps can run.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {needsActivate && (
              <button
                type="button"
                onClick={startCampaign}
                disabled={starting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                Activate campaign
              </button>
            )}
            <button
              type="button"
              onClick={runExecution}
              disabled={running || !prospects?.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              <HiOutlineBolt className="h-4 w-4" />
              {running ? "Running…" : "Run next-best-action"}
            </button>
            <button
              type="button"
              onClick={trackEngagement}
              disabled={tracking || !prospects?.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <HiOutlineArrowPath className="h-4 w-4" />
              {tracking ? "Tracking…" : "Track engagement"}
            </button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Execution results ({results.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {results.map((r) => (
                  <ResultCard
                    key={`${r.prospectId}-${r.commLogId ?? r.reason}`}
                    result={r}
                  />
                ))}
              </div>
            </div>
          )}

          {trackResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Tracking results ({trackResults.length})
              </h3>
              <ul className="text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
                {trackResults.map((r, i) => (
                  <li key={`${r.prospectId}-${r.channel}-${i}`}>
                    {r.channel}: {r.activity ?? "no change"}
                    {r.error ? ` — ${r.error}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {commLogs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Communication log (recent)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-2 py-1.5">Channel</th>
                      <th className="text-left px-2 py-1.5">Stage</th>
                      <th className="text-left px-2 py-1.5">Status</th>
                      <th className="text-left px-2 py-1.5">Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {commLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {CHANNEL_LABELS[log.channel] ?? log.channel}
                        </td>
                        <td className="px-2 py-1.5">S{log.stage ?? "—"}</td>
                        <td className="px-2 py-1.5">{log.status}</td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate text-violet-700">
                          {log.responseType
                            ? `${log.responseType}: ${log.responseContent}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

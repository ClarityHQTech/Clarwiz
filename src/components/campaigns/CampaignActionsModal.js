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
import { HiOutlineBolt } from "react-icons/hi2";
import { toast } from "sonner";
import { modalShell, modalUi } from "@/lib/brandUi";
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
}) {
  const whatsappTemplates = templates.filter((t) => t.channel === "whatsapp");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [results, setResults] = useState([]);
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
      toast.success("Campaign is active — autopilot outreach and webhooks enabled");
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
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent
        {...modalShell.content}
        maxH="90vh"
        className={modalUi.contentClass}
      >
        <ModalHeader
          {...modalShell.header}
          className={`text-base font-semibold text-brand-ink ${modalUi.headerClass}`}
        >
          Campaign actions — {campaignName}
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} />
        <ModalBody className={`space-y-5 ${modalUi.bodyClass}`}>
          <p className="text-sm text-brand-stone">
            Run the next-best-action engine using comm history, live signals, and
            tenant ICP context. Outbound messages are sent via your connected
            channels (Smartlead, LinkedIn, WhatsApp). Opens, replies, and inbound
            messages sync into comm logs via webhooks in real time.
          </p>

          {whatsappTemplates.length > 0 ? (
            <div className="rounded-lg border border-brand-sage/30 bg-brand-sage/15 px-3 py-2 text-xs text-brand-ink">
              <p className="font-medium">WhatsApp templates for this campaign</p>
              <ul className="mt-1 space-y-0.5 list-disc list-inside text-brand-ink/90">
                {whatsappTemplates.map((t) => (
                  <li key={t.id}>
                    S{t.stage}: {t.whatsappTemplateId}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-brand-ink/80">
                Execution only sends templates selected above — not your full
                provider catalog.
              </p>
            </div>
          ) : (
            <p className="text-xs text-brand-ink rounded-lg border border-brand-terracotta/30 bg-brand-terracotta/15 px-3 py-2">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-sage bg-brand-sage/20 px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-sage/25 disabled:opacity-50"
              >
                Activate campaign
              </button>
            )}
            {needsActivate && (
              <>
                <button
                  type="button"
                  onClick={runExecution}
                  disabled={running || !prospects?.length}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-dark px-3 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
                >
                  <HiOutlineBolt className="h-4 w-4" />
                  {running ? "Running…" : "Run outreach"}
                </button>
              </>
            )}
            {!needsActivate && (
              <p className="text-xs text-brand-stone py-2">
                Active campaigns use scheduled autopilot outreach and webhook tracking.
              </p>
            )}
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-brand-ink">
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

          {commLogs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-brand-ink">
                Communication log (recent)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-brand-secondary/30">
                <table className="w-full text-xs">
                  <thead className="bg-brand-bg text-brand-stone">
                    <tr>
                      <th className="text-left px-2 py-1.5">Channel</th>
                      <th className="text-left px-2 py-1.5">Stage</th>
                      <th className="text-left px-2 py-1.5">Status</th>
                      <th className="text-left px-2 py-1.5">Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-secondary/15">
                    {commLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {CHANNEL_LABELS[log.channel] ?? log.channel}
                        </td>
                        <td className="px-2 py-1.5">S{log.stage ?? "—"}</td>
                        <td className="px-2 py-1.5">{log.status}</td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate text-brand-ink">
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
        <ModalFooter {...modalShell.footer} className={modalUi.footerClass}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

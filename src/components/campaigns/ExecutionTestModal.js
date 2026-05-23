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
  Select,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineSignal,
} from "react-icons/hi2";
import { toast } from "sonner";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { DEFAULT_TEST_SIGNAL } from "@/lib/execution/signals";

function ResultCard({ result }) {
  if (result.skipped) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm">
        <p className="font-medium text-gray-900">{result.prospectName}</p>
        <p className="text-amber-800 text-xs mt-1">
          Skipped: {result.reason || result.error || "No action"}
        </p>
        {result.modelUsed && (
          <p className="text-xs text-gray-500 mt-0.5">
            Model: {result.modelUsed}
            {result.providerUsage?.total_tokens != null &&
              ` · ${result.providerUsage.total_tokens} tokens`}
            {result.providerCost?.total_cost_usd != null &&
              ` · $${result.providerCost.total_cost_usd}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-900">{result.prospectName}</p>
        <span className="shrink-0 text-xs rounded-md bg-sky-50 text-sky-800 px-2 py-0.5">
          {CHANNEL_LABELS[result.channel] ?? result.channel} · S{result.stage}
        </span>
      </div>
      {result.subject && (
        <p className="text-xs text-gray-600">
          <span className="font-medium">Subject:</span> {result.subject}
        </p>
      )}
      <p className="text-xs text-gray-700 whitespace-pre-wrap border-l-2 border-sky-200 pl-2">
        {result.message}
      </p>
      <p className="text-xs text-gray-500">
        CTA: {result.ctaType} · Log: {result.commLogId?.slice(0, 8)}…
      </p>
      <p className="text-xs text-gray-500 italic">{result.decisionReason}</p>
      <p className="text-[10px] text-gray-400">
        {result.model ?? result.modelUsed}
        {result.modelTier ? ` (${result.modelTier})` : ""}
        {result.providerUsage?.total_tokens != null &&
          ` · ${result.providerUsage.total_tokens} tok`}
        {result.providerCost?.total_cost_usd != null &&
          ` · $${result.providerCost.total_cost_usd}`}
      </p>
    </div>
  );
}

export default function ExecutionTestModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  prospects,
  onCampaignUpdate,
}) {
  const [running, setRunning] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [signaling, setSignaling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [results, setResults] = useState([]);
  const [commLogs, setCommLogs] = useState([]);
  const [prospectId, setProspectId] = useState("");
  const [replyText, setReplyText] = useState(
    "Thanks for reaching out — I'd like to learn more. Can we schedule a quick call next week?"
  );
  const [signalText, setSignalText] = useState(DEFAULT_TEST_SIGNAL.content);

  useEffect(() => {
    if (isOpen && prospects?.length && !prospectId) {
      setProspectId(prospects[0].id);
    }
  }, [isOpen, prospects, prospectId]);

  const refreshCampaign = useCallback(async () => {
    if (!onCampaignUpdate) return;
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (res.ok) onCampaignUpdate(await res.json());
  }, [campaignId, onCampaignUpdate]);

  const runExecution = async () => {
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
          : "Execution complete — no new actions planned"
      );
      await refreshCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  const simulateSignal = async () => {
    if (!prospectId) {
      toast.error("Select a prospect to simulate a live signal");
      return;
    }
    setSignaling(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "simulate_signal",
          prospectId,
          type: DEFAULT_TEST_SIGNAL.type,
          source: DEFAULT_TEST_SIGNAL.source,
          content: signalText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulate signal failed");
      setResults(data.results ?? []);
      setCommLogs(data.commLogs ?? []);
      toast.success(
        `Signal recorded (${data.signal?.type}) — next-best-action planned`
      );
      await refreshCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSignaling(false);
    }
  };

  const simulateReply = async () => {
    if (!prospectId) {
      toast.error("Select a prospect to simulate a reply");
      return;
    }
    setSimulating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "simulate_reply",
          prospectId,
          content: replyText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulate reply failed");
      setResults(data.results ?? []);
      setCommLogs(data.commLogs ?? []);
      toast.success("Reply recorded — execution re-ran for prospect");
      await refreshCampaign();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const startDrip = async () => {
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
      toast.success("Campaign marked active — use triggers below to test execution");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader className="text-base font-semibold text-gray-900 pr-10">
          Execution test — {campaignName}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody className="space-y-5">
          <p className="text-sm text-gray-600">
            Test harness for the context-aware next-best-action engine. Messages
            are planned and saved to the communication log — nothing is sent to
            real channels yet.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startDrip}
              disabled={starting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              Activate campaign
            </button>
            <button
              type="button"
              onClick={runExecution}
              disabled={running || !prospects?.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              <HiOutlineBolt className="h-4 w-4" />
              {running ? "Running…" : "Run next-best-action (all prospects)"}
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <HiOutlineChatBubbleLeftRight className="h-4 w-4 text-violet-600" />
              Simulate prospect reply
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Prospect
                </label>
                <Select
                  size="sm"
                  value={prospectId}
                  onChange={(e) => setProspectId(e.target.value)}
                >
                  {prospects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.company ? ` · ${p.company}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reply content
              </label>
              <Textarea
                size="sm"
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              colorScheme="purple"
              onClick={simulateReply}
              isLoading={simulating}
              isDisabled={!prospectId}
            >
              Record reply & re-run execution
            </Button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <HiOutlineSignal className="h-4 w-4 text-amber-600" />
              Simulate live signal
            </h3>
            <p className="text-xs text-gray-600">
              Injects an external signal (e.g. LinkedIn post) for the selected
              prospect, then runs the execution layer for a signal-aware
              next-best-action.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Prospect
              </label>
              <Select
                size="sm"
                value={prospectId}
                onChange={(e) => setProspectId(e.target.value)}
              >
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.company ? ` · ${p.company}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Signal ({DEFAULT_TEST_SIGNAL.source} · {DEFAULT_TEST_SIGNAL.type})
              </label>
              <Textarea
                size="sm"
                rows={2}
                value={signalText}
                onChange={(e) => setSignalText(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              colorScheme="orange"
              onClick={simulateSignal}
              isLoading={signaling}
              isDisabled={!prospectId}
            >
              Fire signal & run execution
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Latest run ({results.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {results.map((r) => (
                  <ResultCard key={`${r.prospectId}-${r.commLogId ?? r.reason}`} result={r} />
                ))}
              </div>
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
                      <th className="text-left px-2 py-1.5">Message</th>
                      <th className="text-left px-2 py-1.5">Response</th>
                      <th className="text-left px-2 py-1.5">Model</th>
                      <th className="text-left px-2 py-1.5">Tokens</th>
                      <th className="text-left px-2 py-1.5">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {commLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {CHANNEL_LABELS[log.channel] ?? log.channel}
                        </td>
                        <td className="px-2 py-1.5">S{log.stage ?? "—"}</td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate" title={log.message}>
                          {log.message}
                        </td>
                        <td className="px-2 py-1.5 max-w-[120px] truncate text-violet-700">
                          {log.responseType
                            ? `${log.responseType}: ${log.responseContent}`
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">
                          {log.model?.replace("gpt-", "") ??
                            log.modelUsed?.replace("gpt-", "") ??
                            "—"}
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 tabular-nums">
                          {log.providerUsage?.total_tokens ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 tabular-nums">
                          {log.providerCost?.total_cost_usd != null
                            ? `$${log.providerCost.total_cost_usd}`
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

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { HiOutlineArrowPath, HiOutlineBolt } from "react-icons/hi2";
import { ResultCard } from "@/components/campaigns/executionResultCard";
import { ui } from "@/lib/brandUi";

/**
 * Sequential copilot: for each prospect, run outreach then track.
 */
export default function CampaignCopilotRunner({
  campaignId,
  prospects = [],
  onComplete,
}) {
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [steps, setSteps] = useState([]);

  const runSequential = useCallback(async () => {
    if (!prospects.length) {
      toast.error("Add prospects first");
      return;
    }
    setRunning(true);
    setSteps([]);
    const log = [];

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      setCurrentIndex(i);

      log.push({
        prospectId: prospect.id,
        prospectName: prospect.name,
        phase: "outreach",
        status: "running",
      });
      setSteps([...log]);

      try {
        const execRes = await fetch(`/api/campaigns/${campaignId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "copilot_sequential",
            prospectIds: [prospect.id],
          }),
        });
        const execData = await execRes.json();
        if (!execRes.ok) throw new Error(execData.error || "Outreach failed");

        const execResult = execData.results?.[0];
        log[log.length - 1] = {
          ...log[log.length - 1],
          phase: "outreach",
          status: execResult?.skipped ? "skipped" : "done",
          execResult,
        };
        setSteps([...log]);

        log.push({
          prospectId: prospect.id,
          prospectName: prospect.name,
          phase: "track",
          status: "running",
        });
        setSteps([...log]);

        const trackRes = await fetch(`/api/campaigns/${campaignId}/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectIds: [prospect.id] }),
        });
        const trackData = await trackRes.json();
        if (!trackRes.ok) throw new Error(trackData.error || "Tracking failed");

        log[log.length - 1] = {
          ...log[log.length - 1],
          phase: "track",
          status: "done",
          trackResult: trackData.results?.[0],
          trackSummary: trackData.summary,
        };
        setSteps([...log]);
      } catch (err) {
        log[log.length - 1] = {
          ...log[log.length - 1],
          status: "error",
          error: err.message,
        };
        setSteps([...log]);
        toast.error(`${prospect.name}: ${err.message}`);
      }
    }

    setCurrentIndex(-1);
    setRunning(false);
    toast.success("Copilot run finished");
    onComplete?.();
  }, [campaignId, prospects, onComplete]);

  return (
    <div className={`${ui.cardSurface} p-4 space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">Copilot outreach</h3>
          <p className="text-xs text-brand-stone mt-0.5">
            Runs outreach then tracking for each prospect in order.
          </p>
        </div>
        <button
          type="button"
          disabled={running || prospects.length === 0}
          onClick={runSequential}
          className={`${ui.btnPrimary} disabled:opacity-50 shrink-0`}
        >
          <HiOutlineBolt className="h-4 w-4" />
          {running ? "Running…" : "Run all prospects"}
        </button>
      </div>

      {running && currentIndex >= 0 && (
        <p className="text-xs text-brand-terracotta">
          Processing {currentIndex + 1} of {prospects.length}:{" "}
          {prospects[currentIndex]?.name}
        </p>
      )}

      {steps.length > 0 && (
        <ul className="space-y-2 max-h-64 overflow-y-auto text-xs">
          {steps.map((step, idx) => (
            <li
              key={`${step.prospectId}-${step.phase}-${idx}`}
              className="flex items-start gap-2 border-b border-brand-sand/40 pb-2"
            >
              {step.phase === "track" ? (
                <HiOutlineArrowPath className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-stone" />
              ) : (
                <HiOutlineBolt className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-terracotta" />
              )}
              <div className="min-w-0 flex-1">
                <span className="font-medium text-brand-ink">{step.prospectName}</span>
                <span className="text-brand-stone"> — {step.phase}</span>
                <span
                  className={
                    step.status === "error"
                      ? " text-red-600"
                      : step.status === "running"
                        ? " text-brand-terracotta"
                        : " text-brand-stone"
                  }
                >
                  {" "}
                  ({step.status})
                </span>
                {step.error && (
                  <p className="text-red-600 mt-0.5">{step.error}</p>
                )}
                {step.execResult && !step.execResult.skipped && (
                  <div className="mt-1">
                    <ResultCard result={step.execResult} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

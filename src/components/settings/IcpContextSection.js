"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

const PIPELINE_STEPS = [
  { id: "icp_gap_analysis", label: "ICP gap analysis" },
  { id: "market_research", label: "Market research" },
  { id: "value_proposition", label: "Value proposition" },
  { id: "icp", label: "ICP workbook" },
];

const TOAST_ID = "icp-analysis";

function getStepsToRun(context) {
  const done = {
    icp_gap_analysis: context?.hasIcpGapAnalysis,
    market_research: context?.hasMarketResearch,
    value_proposition: context?.hasValueProposition,
    icp: context?.hasIcpWorkbook,
  };
  const remaining = PIPELINE_STEPS.filter((s) => !done[s.id]);
  return remaining.length > 0 ? remaining : PIPELINE_STEPS;
}

function StepStatus({ context, stepId, activeStepId }) {
  const map = {
    icp_gap_analysis: context?.hasIcpGapAnalysis,
    market_research: context?.hasMarketResearch,
    value_proposition: context?.hasValueProposition,
    icp: context?.hasIcpWorkbook,
  };
  const done = map[stepId];
  const active =
    activeStepId === stepId ||
    (context?.status === "analyzing" && context?.currentStep === stepId);

  if (active) {
    return (
      <span className="text-xs font-medium text-brand-ink bg-brand-terracotta/15 px-2 py-0.5 rounded">
        Running…
      </span>
    );
  }
  if (done) {
    return (
      <span className="text-xs font-medium text-brand-ink bg-brand-sage/20 px-2 py-0.5 rounded">
        Done
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-brand-steel bg-brand-bg px-2 py-0.5 rounded">
      Pending
    </span>
  );
}

function OutputPreview({ title, preview }) {
  const [open, setOpen] = useState(false);
  if (!preview) return null;

  return (
    <div className="rounded-lg border border-brand-secondary/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 bg-brand-bg/60 px-3 py-2 text-left hover:bg-brand-bg/80"
      >
        <span className="text-sm font-medium text-brand-ink">{title}</span>
        {open ? (
          <HiOutlineChevronDown className="h-4 w-4 text-brand-stone" />
        ) : (
          <HiOutlineChevronRight className="h-4 w-4 text-brand-stone" />
        )}
      </button>
      {open ? (
        <pre className="border-t border-brand-secondary/30 bg-brand-surface p-3 text-xs text-brand-stone whitespace-pre-wrap max-h-64 overflow-y-auto">
          {preview}
        </pre>
      ) : null}
    </div>
  );
}

async function runAnalyzeStep(stepId) {
  let res;
  try {
    res = await fetch("/api/tenant/icp/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "step", step: stepId }),
    });
  } catch {
    throw new Error(
      "Network error while calling the analysis API. Refresh and click Run again to resume this step."
    );
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error(
      res.status === 504
        ? "This step took too long. Click Run again to resume from the last completed step."
        : `Analysis request failed (${res.status})`
    );
  }

  if (!res.ok) throw new Error(data.error || "Analysis step failed");
  return data.context;
}

export default function IcpContextSection() {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeStepId, setActiveStepId] = useState(null);
  const [extractingSignals, setExtractingSignals] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [relevantData, setRelevantData] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [accountData, setAccountData] = useState("");

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/icp");
      if (!res.ok) throw new Error("Failed to load ICP context");
      const data = await res.json();
      setContext(data.context);
      if (data.context) {
        setCompanyName(data.context.companyName || "");
        setCompanyDomain(data.context.companyDomain || "");
        setRelevantData(data.context.relevantData || "");
        setUserQuery(data.context.userQuery || "");
        setAccountData(data.context.accountData || "");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const saveInputs = async ({ silent = false } = {}) => {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant/icp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyDomain,
          relevantData,
          userQuery,
          accountData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setContext(data.context);
      if (!silent) toast.success("Company context saved");
      return data.context;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const runPipeline = async () => {
    setAnalyzing(true);
    toast.loading("Saving company context…", { id: TOAST_ID, duration: Infinity });

    try {
      const saved = await saveInputs({ silent: true });
      const steps = getStepsToRun(saved);
      const total = steps.length;

      for (let i = 0; i < steps.length; i++) {
        const { id, label } = steps[i];
        setActiveStepId(id);

        toast.loading(
          `${label} (${i + 1}/${total}) — calling GTM Core (up to ~5 min per step, auto-retries on disconnect)…`,
          { id: TOAST_ID, duration: Infinity }
        );

        const updated = await runAnalyzeStep(id);
        setContext(updated);

        toast.loading(`Finished ${label} (${i + 1}/${total})`, {
          id: TOAST_ID,
          duration: 2000,
        });
      }

      setActiveStepId(null);
      toast.success("ICP analysis complete — execution layer will use this context", {
        id: TOAST_ID,
        duration: 5000,
      });
    } catch (err) {
      setActiveStepId(null);
      toast.error(err.message, { id: TOAST_ID, duration: 8000 });
      await fetchContext();
    } finally {
      setAnalyzing(false);
    }
  };

  const runSignalExtraction = async () => {
    setExtractingSignals(true);
    const toastId = "icp-signals";
    toast.loading("Extracting account signals…", { id: toastId, duration: Infinity });

    try {
      await saveInputs({ silent: true });
      const res = await fetch("/api/tenant/icp/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "account_signals" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signal extraction failed");
      setContext(data.context);
      toast.success("Account signals extracted", { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId, duration: 8000 });
      await fetchContext();
    } finally {
      setExtractingSignals(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading ICP context…</p>;
  }

  const isAnalyzing = context?.status === "analyzing" || analyzing;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-ink">
          <HiOutlineSparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">ICP & tenant context</h3>
          <p className="mt-1 text-sm text-brand-stone leading-relaxed">
            Run GTM Core analysis on your company. Results are stored per workspace and
            injected into campaign execution for next-best-action decisions.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-brand-stone">Company name</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            className={`mt-1 ${ui.inputSurface}`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-brand-stone">Company domain</span>
          <input
            type="text"
            value={companyDomain}
            onChange={(e) => setCompanyDomain(e.target.value)}
            placeholder="acme.com"
            className={`mt-1 ${ui.inputSurface}`}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-brand-stone">Company knowledge</span>
        <span className="ml-1 text-brand-steel font-normal">(required)</span>
        <p className="text-xs text-brand-stone mt-0.5">
          Website copy, product docs, CRM notes, or positioning — used by all analysis tools.
        </p>
        <textarea
          value={relevantData}
          onChange={(e) => setRelevantData(e.target.value)}
          rows={6}
          placeholder="Paste your company overview, product description, target market, differentiators…"
          className={`mt-1 ${ui.inputSurface} resize-y`}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-brand-stone">Focus instruction</span>
        <span className="ml-1 text-brand-steel font-normal">(optional)</span>
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="e.g. focus on enterprise SaaS accounts in North America"
          className={`mt-1 ${ui.inputSurface}`}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => saveInputs()}
          disabled={saving || isAnalyzing}
          className="rounded-lg border border-brand-secondary/30 bg-brand-surface px-4 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save inputs"}
        </button>
        <button
          type="button"
          onClick={runPipeline}
          disabled={isAnalyzing || extractingSignals || !companyName || !companyDomain || !relevantData}
          className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
        >
          {isAnalyzing ? "Running analysis…" : "Run full ICP analysis"}
        </button>
      </div>

      <p className="text-xs text-brand-stone">
        Full pipeline: ICP gap analysis → market research → value proposition → ICP workbook.
        Each step runs separately and can take up to 10 minutes (market research is often the
        slowest). If a step fails, click again to resume from where it stopped.
      </p>

      <ul className="space-y-2">
        {PIPELINE_STEPS.map((step) => (
          <li
            key={step.id}
            className="flex items-center justify-between rounded-lg border border-brand-secondary/15 bg-brand-bg/50 px-3 py-2"
          >
            <span className="text-sm text-brand-stone">{step.label}</span>
            <StepStatus
              context={context}
              stepId={step.id}
              activeStepId={activeStepId}
            />
          </li>
        ))}
      </ul>

      {context?.status === "complete" ? (
        <p className="text-xs text-brand-ink">
          Analysis complete
          {context.analyzedAt
            ? ` · ${new Date(context.analyzedAt).toLocaleString()}`
            : ""}
          . Campaign execution will use this ICP context.
        </p>
      ) : null}

      {context?.lastError ? (
        <p className="text-xs text-red-600 rounded-lg bg-red-50 border border-red-100 p-3">
          {context.lastError}
        </p>
      ) : null}

      <div className="border-t border-brand-secondary/15 pt-6 space-y-3">
        <h4 className="text-sm font-semibold text-brand-ink">Account signal extractor</h4>
        <p className="text-xs text-brand-stone">
          Optional: extract GTM signals from call transcripts, CRM notes, or email threads.
          Runs independently; scores better when ICP workbook exists.
        </p>
        <textarea
          value={accountData}
          onChange={(e) => setAccountData(e.target.value)}
          rows={4}
          placeholder="Paste account-level raw data (transcript, notes, activity log)…"
          className={`${ui.inputSurface} resize-y`}
        />
        <button
          type="button"
          onClick={runSignalExtraction}
          disabled={extractingSignals || isAnalyzing || !accountData?.trim()}
          className="rounded-lg border border-brand-secondary/30 bg-brand-surface px-4 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg disabled:opacity-50"
        >
          {extractingSignals ? "Extracting…" : "Extract account signals"}
        </button>
        {context?.hasAccountSignals ? (
          <OutputPreview title="Account signals" preview={context.accountSignalsPreview} />
        ) : null}
      </div>

      {context?.hasIcpWorkbook ? (
        <div className="space-y-2 border-t border-brand-secondary/15 pt-4">
          <h4 className="text-sm font-semibold text-brand-ink">Stored outputs</h4>
          <OutputPreview title="ICP gap analysis" preview={context.icpGapAnalysisPreview} />
          <OutputPreview title="Market research" preview={context.marketResearchPreview} />
          <OutputPreview title="Value proposition" preview={context.valuePropositionPreview} />
          <OutputPreview title="ICP workbook" preview={context.icpWorkbookPreview} />
        </div>
      ) : null}
    </div>
  );
}

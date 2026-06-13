"use client";

import { useCallback, useEffect, useState } from "react";
import { HiOutlineBeaker, HiOutlineSparkles, HiOutlineEye } from "react-icons/hi2";
import { toast } from "sonner";
import CollateralEditorModal from "./CollateralEditorModal";
import CollateralPreviewFrame from "./CollateralPreviewFrame";
import { ui } from "@/lib/brandUi";

const TEMPLATE_OPTIONS = [
  { key: "brochure", label: "Product brochure", hint: "Tri-fold marketing brochure" },
  { key: "battlecard", label: "Competitive battlecard", hint: "Multi-page 16:9 battlecard" },
  { key: "sales_deck", label: "Sales deck", hint: "Slide-style pitch deck" },
];

export default function CollateralDemoLab({ demoScenarios = [], onGenerated }) {
  const [templateKey, setTemplateKey] = useState("brochure");
  const [scenarioId, setScenarioId] = useState(demoScenarios[0]?.id || "acme_discovery");
  const [loading, setLoading] = useState(null);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    if (demoScenarios.length && !demoScenarios.find((s) => s.id === scenarioId)) {
      setScenarioId(demoScenarios[0].id);
    }
  }, [demoScenarios, scenarioId]);

  const selectedScenario = demoScenarios.find((s) => s.id === scenarioId);

  const run = useCallback(
    async (mode) => {
      setLoading(mode);
      setPreviewHtml(null);
      try {
        const res = await fetch("/api/assist/collateral/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateKey,
            scenarioId,
            mode: mode === "preview" ? "preview" : mode === "ai" ? "ai" : "save",
            saveToLibrary: mode === "save",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            data.error === "anthropic_not_configured"
              ? "AI personalize needs Anthropic API key"
              : data.error === "ai_personalize_failed"
                ? "AI personalize failed — try instant preview"
                : data.error || "Generation failed";
          toast.error(msg);
          return;
        }

        if (mode === "preview") {
          setPreviewHtml(data.html);
          toast.success("Preview ready");
          return;
        }

        if (data.documentId) {
          setEditor({ documentId: data.documentId, title: data.title });
          onGenerated?.(data);
          toast.success(mode === "ai" ? "AI collateral saved — open editor" : "Demo collateral saved");
        }
      } catch {
        toast.error("Generation failed");
      } finally {
        setLoading(null);
      }
    },
    [templateKey, scenarioId, onGenerated]
  );

  return (
    <section className={`${ui.cardSurface} p-5 space-y-5 border-2 border-dashed border-brand-terracotta/30`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/20 text-brand-ink">
          <HiOutlineBeaker className="h-5 w-5" />
        </div>
        <div>
          <h2 className={ui.titleSm}>Demo lab</h2>
          <p className={`${ui.body} text-sm mt-1`}>
            Test brochure, battlecard, and sales deck layouts with sample prospect data.{" "}
            <strong className="font-medium text-brand-ink">Instant preview</strong> shows placeholder copy only.{" "}
            When NBA creates collateral on a deal, every label and description is hyper-personalized for your tenant and that prospect.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-brand-stone uppercase tracking-wide">
            Template type
          </label>
          <div className="grid gap-2">
            {TEMPLATE_OPTIONS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplateKey(t.key)}
                className={`text-left rounded-lg border px-4 py-3 transition ${
                  templateKey === t.key
                    ? "border-brand-terracotta bg-brand-terracotta/10"
                    : "border-brand-secondary/20 hover:border-brand-terracotta/40"
                }`}
              >
                <p className="text-sm font-medium text-brand-ink">{t.label}</p>
                <p className="text-xs text-brand-stone mt-0.5">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-brand-stone uppercase tracking-wide">
            Demo prospect data
          </label>
          <select
            className={ui.input}
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
          >
            {demoScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {selectedScenario ? (
            <p className="text-sm text-brand-stone bg-brand-bg rounded-lg p-3">{selectedScenario.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ui.btnSecondarySurface}
          onClick={() => run("preview")}
          disabled={!!loading}
        >
          <HiOutlineEye className="h-4 w-4" />
          {loading === "preview" ? "Rendering…" : "Preview (sample copy)"}
        </button>
        <button
          type="button"
          className={ui.btnPrimary}
          onClick={() => run("ai")}
          disabled={!!loading}
        >
          <HiOutlineSparkles className="h-4 w-4" />
          {loading === "ai" ? "Hyper-personalizing…" : "Hyper-personalize & save"}
        </button>
        <button
          type="button"
          className={ui.btnSecondarySurface}
          onClick={() => run("save")}
          disabled={!!loading}
        >
          {loading === "save" ? "Saving…" : "Fill & save to library"}
        </button>
      </div>

      {previewHtml ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold text-xs uppercase tracking-wide text-amber-800">Template preview</p>
            <p className="mt-1">
              Sample layout with placeholder copy. Production collateral from NBA will hyper-personalize all text —
              including descriptions beside icons — for your tenant and each prospect company.
            </p>
          </div>
          <div className="rounded-lg border border-brand-secondary/20 overflow-hidden h-[min(70vh,720px)] flex flex-col min-h-0">
            <CollateralPreviewFrame srcDoc={previewHtml} title="Collateral demo preview" />
          </div>
        </div>
      ) : null}

      {editor ? (
        <CollateralEditorModal
          documentId={editor.documentId}
          title={editor.title}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </section>
  );
}

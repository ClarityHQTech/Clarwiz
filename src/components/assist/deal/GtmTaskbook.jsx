"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AssistPanel, AssistEmpty } from "../ui/AssistPanel";
import { ui } from "@/lib/brandUi";

export default function GtmTaskbook({ dealId, gtmPaths }) {
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const stepsByKey = useMemo(() => {
    const map = {};
    gtmPaths.forEach((p) => {
      p.steps.forEach((step, si) => {
        map[`${p.index}:${si}`] = {
          subject: step,
          body: p.whyThisWorks ? `Why this works: ${p.whyThisWorks}` : "",
        };
      });
    });
    return map;
  }, [gtmPaths]);

  const selectedKeys = Object.keys(selected).filter((k) => selected[k]);
  const toggle = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }));

  const onCreate = async () => {
    const steps = selectedKeys.map((k) => stepsByKey[k]).filter(Boolean);
    if (!steps.length) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Integrations to create tasks.");
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Failed to create tasks");
        return;
      }
      if (data.ok === false && data.reason === "write_scope") {
        toast.warning("Your HubSpot token lacks task write scope.");
        return;
      }
      const n = data.created?.length ?? 0;
      toast.success(`Created ${n} task${n === 1 ? "" : "s"} in HubSpot`);
      if (data.partial) toast.warning("Some tasks were blocked by HubSpot scopes.");
      setSelected({});
    } catch {
      toast.error("Failed to create tasks");
    } finally {
      setSubmitting(false);
    }
  };

  if (!gtmPaths.length) {
    return (
      <AssistPanel title="GTM taskbook">
        <AssistEmpty>No GTM paths suggested yet.</AssistEmpty>
      </AssistPanel>
    );
  }

  const action = (
    <button
      type="button"
      className={`${ui.btnGhost} disabled:opacity-50`}
      onClick={onCreate}
      disabled={!selectedKeys.length || submitting}
    >
      {submitting ? "Creating…" : `Create ${selectedKeys.length || ""} task${selectedKeys.length === 1 ? "" : "s"}`}
    </button>
  );

  return (
    <AssistPanel title="GTM taskbook" action={action}>
      <div className="divide-y divide-brand-secondary/15">
        {gtmPaths.map((path) => (
          <div key={path.index} className="px-4 py-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm font-medium text-brand-ink">{path.title}</p>
              {path.scoreImpact != null ? (
                <span className="text-xs font-medium text-brand-terracotta shrink-0">+{path.scoreImpact} score</span>
              ) : null}
            </div>
            {path.steps.length ? (
              <ul className="space-y-2">
                {path.steps.map((step, si) => {
                  const key = `${path.index}:${si}`;
                  const done = !!selected[key];
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={`flex w-full items-start gap-2 text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                          done
                            ? "border-brand-sage/50 bg-brand-sage/15 text-brand-ink"
                            : "border-brand-secondary/25 hover:bg-brand-bg text-brand-stone"
                        }`}
                        onClick={() => toggle(key)}
                        aria-pressed={done}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${
                            done ? "border-brand-sage bg-brand-sage text-white" : "border-brand-steel"
                          }`}
                        >
                          {done ? "✓" : ""}
                        </span>
                        {step}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-brand-stone">No steps listed.</p>
            )}
            {path.whyThisWorks ? (
              <p className="text-xs text-brand-stone mt-3">Why this works: {path.whyThisWorks}</p>
            ) : null}
          </div>
        ))}
      </div>
    </AssistPanel>
  );
}

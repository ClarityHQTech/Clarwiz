"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CkCard } from "../cockpit/primitives";

/**
 * GTM paths rendered as a cockpit taskbook with checkable steps. Selected steps
 * are pushed to HubSpot as tasks via POST /api/assist/deal/[id]/tasks (unchanged).
 */
export default function GtmTaskbook({ dealId, gtmPaths }) {
  const [selected, setSelected] = useState({}); // `${pathIndex}:${stepIndex}` -> bool
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
        toast.error("Connect HubSpot in Settings to create tasks.");
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
      <CkCard title="GTM Taskbook">
        <div className="ck-empty">No GTM paths suggested yet.</div>
      </CkCard>
    );
  }

  const action = (
    <button
      type="button"
      className="ck-card-action"
      onClick={onCreate}
      disabled={!selectedKeys.length || submitting}
      style={{ color: selectedKeys.length ? "var(--accent)" : undefined }}
    >
      {submitting ? "Creating…" : `Create ${selectedKeys.length || ""} task${selectedKeys.length === 1 ? "" : "s"}`}
    </button>
  );

  return (
    <CkCard title="GTM Taskbook" action={action}>
      {gtmPaths.map((path) => (
        <div className="ck-task-path" key={path.index}>
          <div className="ck-task-path-header">
            <div className="ck-task-path-title">{path.title}</div>
            {path.scoreImpact != null && <div className="ck-task-path-impact">+{path.scoreImpact} score</div>}
          </div>
          {path.steps.length ? (
            <ul className="ck-task-steps">
              {path.steps.map((step, si) => {
                const key = `${path.index}:${si}`;
                const done = !!selected[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`ck-task-step${done ? " done" : ""}`}
                      onClick={() => toggle(key)}
                      aria-pressed={done}
                    >
                      <span className="ck-task-checkbox">✓</span>
                      {step}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="ck-risk-desc">No steps listed.</div>
          )}
          {path.whyThisWorks && <div className="ck-task-why">Why this works: {path.whyThisWorks}</div>}
        </div>
      ))}
    </CkCard>
  );
}

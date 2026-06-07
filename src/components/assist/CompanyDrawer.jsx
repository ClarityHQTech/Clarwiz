"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SectionTitle, InsightRow, KvGrid, CkBadge, initials } from "./cockpit/primitives";
import { fmtAmountShort, fmtStaleness, asScore } from "./cockpit/format";
import { tierDot, signalLabel } from "./deal/SignalsStrip";

/* ----------------------------- payload helpers ---------------------------- */
function s(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function arr(v) {
  return Array.isArray(v) ? v : [];
}
function pluck(rows, key) {
  return arr(rows)
    .map((r) => (r && typeof r === "object" ? s(r[key]) : s(r)))
    .filter(Boolean);
}

const TABS = [
  "Overview",
  "Stakeholders",
  "Value",
  "Risks",
  "Actions",
  "Timeline",
  "Competitive",
  "Expansion",
  "Research",
  "Signals",
];

function Empty({ children }) {
  return <div className="ck-empty">{children || "Nothing computed for this tab yet."}</div>;
}

/* --------------------------------- tabs ----------------------------------- */
function OverviewTab({ payload, insight, signals }) {
  const briefing = s(payload.account_level_briefing) || s(payload.brief_summary);
  const summary = s(payload.brief_summary) !== briefing ? s(payload.brief_summary) : null;
  const meta = payload.intelligence_layer_meta && typeof payload.intelligence_layer_meta === "object" ? payload.intelligence_layer_meta : {};
  const rec = payload.recommended_next_best_actions && typeof payload.recommended_next_best_actions === "object" ? payload.recommended_next_best_actions : {};
  if (!briefing && !summary && !s(rec.ae)) return <Empty>No overview computed yet. Run an analysis.</Empty>;
  return (
    <>
      {briefing && (
        <div className="ck-briefing" style={{ marginBottom: 18 }}>
          <div className="ck-briefing-label">Primary Recommendation</div>
          <div className="ck-briefing-text">{briefing}</div>
        </div>
      )}
      {summary && (
        <>
          <SectionTitle>Summary</SectionTitle>
          <div className="ck-risk-desc" style={{ marginBottom: 8 }}>{summary}</div>
        </>
      )}
      {s(rec.ae) && (
        <>
          <SectionTitle>Recommended next move</SectionTitle>
          <div className="ck-card">
            <InsightRow name={s(rec.ae)} badge={<CkBadge variant="accent">AE</CkBadge>} />
            {s(rec.system) && <InsightRow name={s(rec.system)} badge={<CkBadge variant="info">System</CkBadge>} />}
            {s(rec.marketing) && <InsightRow name={s(rec.marketing)} badge={<CkBadge variant="ghost">Marketing</CkBadge>} />}
            {s(rec.cs) && <InsightRow name={s(rec.cs)} badge={<CkBadge variant="ghost">CS</CkBadge>} />}
          </div>
        </>
      )}
      <SectionTitle>Intelligence confidence</SectionTitle>
      <KvGrid
        items={[
          { label: "Account score", value: asScore(payload.account_score) },
          { label: "Active signals", value: signals.length || null },
          { label: "Signal density 7d", value: s(meta.signal_density_7d) },
          { label: "Signal confidence", value: s(meta.signal_confidence) },
          { label: "Contact coverage", value: s(meta.contact_coverage_depth) },
          { label: "Last refresh", value: insight?.computedAt ? fmtStaleness(insight.computedAt) : null },
        ]}
      />
    </>
  );
}

function personaList(payload) {
  // payload.gtm_noun_matches[].persona[].persona_matches
  const out = [];
  arr(payload.gtm_noun_matches).forEach((m) => {
    arr(m?.persona).forEach((p) => {
      const label = s(p?.persona_matches) || s(p);
      if (label) out.push(label);
    });
  });
  return out;
}

function StakeholdersTab({ payload, contacts }) {
  const personas = personaList(payload);
  if (!contacts.length && !personas.length) return <Empty>No stakeholders mapped yet.</Empty>;
  return (
    <>
      {contacts.length > 0 && (
        <>
          <SectionTitle>Known contacts</SectionTitle>
          {contacts.map((c) => {
            const bu = c.businessUser ?? {};
            const name = bu.name || bu.email || "Contact";
            return (
              <div className="ck-stakeholder" key={c.id}>
                <div className="ck-sh-avatar">{initials(name)}</div>
                <div className="ck-sh-info">
                  <div className="ck-sh-name">{name}</div>
                  {bu.jobTitle && <div className="ck-sh-role">{bu.jobTitle}</div>}
                </div>
                {c.persona && (
                  <div className="ck-sh-meters">
                    <div className="ck-sh-meter">
                      <div className="lbl">Persona</div>
                      <div className="val">{c.persona}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      {personas.length > 0 && (
        <>
          <SectionTitle>Persona matches (AURA)</SectionTitle>
          <div className="ck-card">
            {personas.map((p, i) => (
              <InsightRow key={i} name={p} badge={<CkBadge variant="accent">Persona</CkBadge>} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ValueTab({ payload, deals }) {
  const positives = pluck(payload.positive_outcomes_observed, "outcome");
  const mm = payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object" ? payload.mental_model_reasoning_summary : {};
  const openValue = deals.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  if (!positives.length && !s(payload.net_deal_confidence_uplift) && !openValue) return <Empty>No value drivers computed yet.</Empty>;
  return (
    <>
      <SectionTitle>Value snapshot</SectionTitle>
      <KvGrid
        items={[
          { label: "Open pipeline", value: openValue ? fmtAmountShort(openValue) : null },
          { label: "Confidence uplift", value: s(payload.net_deal_confidence_uplift) },
          { label: "Opportunity tradeoff", value: s(mm.opportunity_cost_delta) },
        ]}
      />
      {positives.length > 0 && (
        <>
          <SectionTitle>Realized / positive outcomes</SectionTitle>
          <div className="ck-card">
            {positives.map((p, i) => (
              <InsightRow key={i} name={p} badge={<CkBadge variant="ok">Win</CkBadge>} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function RisksTab({ payload }) {
  const warnings = pluck(payload.early_warning_signal, "warning_signal");
  const mm = payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object" ? payload.mental_model_reasoning_summary : {};
  const inversion = s(mm.inversion_risk_detected);
  if (!warnings.length && !inversion) return <Empty>No risks detected yet.</Empty>;
  return (
    <div className="ck-card">
      {warnings.map((w, i) => (
        <InsightRow key={i} name={w} badge={<CkBadge variant="danger">Risk</CkBadge>} />
      ))}
      {inversion && (
        <InsightRow name="Likely failure modes" badge={<CkBadge variant="warn">Inversion</CkBadge>}>
          {inversion}
        </InsightRow>
      )}
    </div>
  );
}

function ActionsTab({ payload }) {
  const rec = payload.recommended_next_best_actions && typeof payload.recommended_next_best_actions === "object" ? payload.recommended_next_best_actions : {};
  const flow = payload.suggested_follow_up_flow && typeof payload.suggested_follow_up_flow === "object" ? payload.suggested_follow_up_flow : {};
  const rows = [
    s(rec.ae) && { name: s(rec.ae), badge: <CkBadge variant="danger">AE · P1</CkBadge> },
    s(rec.system) && { name: s(rec.system), badge: <CkBadge variant="info">System</CkBadge> },
    s(rec.marketing) && { name: s(rec.marketing), badge: <CkBadge variant="ghost">Marketing</CkBadge> },
    s(rec.cs) && { name: s(rec.cs), badge: <CkBadge variant="ghost">CS</CkBadge> },
  ].filter(Boolean);
  const flowRows = [
    s(flow.day_0) && { d: "Day 0", v: s(flow.day_0) },
    s(flow.day_3) && { d: "Day 3", v: s(flow.day_3) },
    s(flow.day_6) && { d: "Day 6", v: s(flow.day_6) },
  ].filter(Boolean);
  if (!rows.length && !flowRows.length) return <Empty>No actions recommended yet.</Empty>;
  return (
    <>
      {rows.length > 0 && (
        <>
          <SectionTitle>Recommended actions</SectionTitle>
          <div className="ck-card" style={{ marginBottom: 14 }}>
            {rows.map((r, i) => (
              <InsightRow key={i} name={r.name} badge={r.badge} />
            ))}
          </div>
        </>
      )}
      {flowRows.length > 0 && (
        <>
          <SectionTitle>Suggested follow-up flow</SectionTitle>
          <div className="ck-card">
            {flowRows.map((r, i) => (
              <InsightRow key={i} name={r.d} badge={<CkBadge variant="accent">{r.d}</CkBadge>}>
                {r.v}
              </InsightRow>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TimelineTab({ payload }) {
  const mm = payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object" ? payload.mental_model_reasoning_summary : {};
  const forecast = s(mm.second_order_forecast);
  const loop = s(mm.feedback_loop_effect);
  const likelihood = s(payload.likelihood_to_progress);
  if (!forecast && !loop && !likelihood) return <Empty>No forecast computed yet.</Empty>;
  return (
    <div className="ck-card">
      {likelihood && (
        <InsightRow name="Likelihood to progress" badge={<CkBadge variant="ok">{likelihood}</CkBadge>} />
      )}
      {forecast && (
        <InsightRow name="Second-order forecast" badge={<CkBadge variant="info">Forecast</CkBadge>}>
          {forecast}
        </InsightRow>
      )}
      {loop && (
        <InsightRow name="Feedback loop effect" badge={<CkBadge variant="ghost">Loop</CkBadge>}>
          {loop}
        </InsightRow>
      )}
    </div>
  );
}

function CompetitiveTab({ payload, signals }) {
  const compSignals = signals.filter((sig) =>
    /compet|salesforce|rival|alternative|vs /i.test(`${sig.type || ""} ${sig.headline || ""} ${sig.category || ""}`)
  );
  const mm = payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object" ? payload.mental_model_reasoning_summary : {};
  const bottleneck = s(mm.system_bottleneck_addressed);
  if (!compSignals.length && !bottleneck) return <Empty>No competitive threats detected.</Empty>;
  return (
    <div className="ck-card">
      {compSignals.map((sig) => (
        <InsightRow key={sig.id} name={signalLabel(sig)} badge={<CkBadge variant="warn">Threat</CkBadge>}>
          {sig.evidence || sig.suggestedAngle}
        </InsightRow>
      ))}
      {bottleneck && (
        <InsightRow name="System bottleneck" badge={<CkBadge variant="info">Focus</CkBadge>}>
          {bottleneck}
        </InsightRow>
      )}
    </div>
  );
}

function ExpansionTab({ payload }) {
  const detected = payload.aura_insight_detected && typeof payload.aura_insight_detected === "object" ? payload.aura_insight_detected : {};
  const paths = arr(detected.gtm_paths_you_can_pursue).filter((p) => p && typeof p === "object");
  if (!paths.length) return <Empty>No expansion vectors identified yet.</Empty>;
  return (
    <>
      <SectionTitle>Growth vectors</SectionTitle>
      <div className="ck-card">
        {paths.map((p, i) => (
          <InsightRow
            key={i}
            name={s(p.title) || `Path ${i + 1}`}
            badge={s(p.score_impact) ? <CkBadge variant="accent">{s(p.score_impact)}</CkBadge> : null}
          >
            {s(p.why_this_works)}
            {arr(p.path_steps).length ? ` · ${arr(p.path_steps).filter(Boolean).join(" → ")}` : ""}
          </InsightRow>
        ))}
      </div>
    </>
  );
}

function ResearchTab({ payload }) {
  const summary = s(payload.brief_summary);
  const coach = s(payload.your_coach_speaks);
  const mm = payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object" ? payload.mental_model_reasoning_summary : {};
  const root = s(mm.first_principles_target);
  if (!summary && !coach && !root) return <Empty>No research notes computed yet.</Empty>;
  return (
    <>
      {summary && (
        <div className="ck-briefing" style={{ marginBottom: 14 }}>
          <div className="ck-briefing-label">Summary</div>
          <div className="ck-briefing-text">{summary}</div>
        </div>
      )}
      {coach && (
        <div className="ck-briefing" style={{ marginBottom: 14 }}>
          <div className="ck-briefing-label">Your coach speaks</div>
          <div className="ck-briefing-text" style={{ fontStyle: "italic" }}>{coach}</div>
        </div>
      )}
      {root && (
        <>
          <SectionTitle>First-principles root cause</SectionTitle>
          <div className="ck-risk-desc">{root}</div>
        </>
      )}
    </>
  );
}

function SignalsTab({ signals }) {
  if (!signals.length) return <Empty>No signals detected.</Empty>;
  return (
    <div className="ck-card">
      {signals.map((sig) => (
        <InsightRow
          key={sig.id}
          name={signalLabel(sig)}
          badge={
            <CkBadge variant={tierDot(sig) === "t1" ? "danger" : tierDot(sig) === "t2" ? "warn" : "info"}>
              {typeof sig.score === "number" ? `Score ${sig.score}` : "Signal"}
            </CkBadge>
          }
        >
          {sig.evidence || sig.suggestedAngle}
        </InsightRow>
      ))}
    </div>
  );
}

/* ------------------------------- drawer ----------------------------------- */
export default function CompanyDrawer({ accountId, isOpen, onClose }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState("Overview");

  const loadView = useCallback(async (id) => {
    setLoading(true);
    setView(null);
    try {
      const res = await fetch(`/api/assist/account/${id}/view`);
      if (!res.ok) {
        toast.error("Could not load company");
        return;
      }
      const data = await res.json();
      setView(data.view);
    } catch {
      toast.error("Could not load company");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && accountId) {
      setTab("Overview");
      loadView(accountId);
    }
  }, [isOpen, accountId, loadView]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const onAnalyze = async () => {
    if (!accountId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/assist/account/${accountId}/recompute`, { method: "POST" });
      if (!res.ok) {
        toast.error("Analysis failed — please try again.");
        return;
      }
      toast.success("Account analyzed");
      await loadView(accountId);
      router.refresh();
    } catch {
      toast.error("Analysis failed — please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  const company = view?.company ?? {};
  const insight = view?.insight ?? null;
  const payload = insight?.payload && typeof insight.payload === "object" ? insight.payload : {};
  const signals = arr(view?.signals);
  const contacts = arr(view?.contacts);
  const deals = arr(view?.deals);
  const score = asScore(payload.account_score);

  const tabProps = { payload, insight, signals, contacts, deals };
  const TAB_RENDER = {
    Overview: <OverviewTab {...tabProps} />,
    Stakeholders: <StakeholdersTab {...tabProps} />,
    Value: <ValueTab {...tabProps} />,
    Risks: <RisksTab {...tabProps} />,
    Actions: <ActionsTab {...tabProps} />,
    Timeline: <TimelineTab {...tabProps} />,
    Competitive: <CompetitiveTab {...tabProps} />,
    Expansion: <ExpansionTab {...tabProps} />,
    Research: <ResearchTab {...tabProps} />,
    Signals: <SignalsTab {...tabProps} />,
  };

  return (
    <div className="cockpit">
      <div className="ck-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
        <div className="ck-drawer" role="dialog" aria-label="Company">
          <div className="ck-drawer-header">
            <button
              type="button"
              className="ck-drawer-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
            <div className="ck-drawer-eyebrow">
              Account{company.industry ? ` · ${company.industry}` : ""}
              {company.domain ? ` · ${company.domain}` : ""}
            </div>
            <h2 className="ck-drawer-title">{company.name || "Company"}</h2>
            <div className="ck-drawer-stats">
              <div>
                <div className="lbl">Health</div>
                <div className="val">{score != null ? `${score} / 100` : "—"}</div>
              </div>
              <div>
                <div className="lbl">Open deals</div>
                <div className="val">{deals.length}</div>
              </div>
              <div>
                <div className="lbl">Signals</div>
                <div className="val">{signals.length}</div>
              </div>
              <div>
                <div className="lbl">Last refresh</div>
                <div className="val">{insight?.computedAt ? fmtStaleness(insight.computedAt) : "Never"}</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button type="button" className="ck-btn ck-btn-ghost" onClick={onAnalyze} disabled={analyzing}>
                  {analyzing ? "Analyzing…" : insight ? "Re-analyze" : "Analyze"}
                </button>
              </div>
            </div>
          </div>

          <div className="ck-drawer-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`ck-drawer-tab${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="ck-drawer-body">
            {loading ? (
              <div className="ck-spinner-wrap">
                <div className="ck-spinner" />
              </div>
            ) : !view ? (
              <Empty>Nothing to show.</Empty>
            ) : !insight && tab !== "Signals" && tab !== "Stakeholders" ? (
              <div className="ck-card" style={{ padding: 28, textAlign: "center" }}>
                <p className="ck-risk-desc" style={{ marginBottom: 16 }}>
                  No intelligence yet for {company.name || "this account"}. Run an analysis to populate
                  the briefing, risks, actions and signals.
                </p>
                <button type="button" className="ck-btn ck-btn-primary" onClick={onAnalyze} disabled={analyzing}>
                  {analyzing ? "Analyzing…" : "Analyze this account"}
                </button>
              </div>
            ) : (
              TAB_RENDER[tab]
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";
import { toast } from "sonner";
import AssistBadge from "./ui/AssistBadge";
import { AssistEmpty } from "./ui/AssistPanel";
import { SectionTitle, InsightRow, KvGrid, initials, BriefingBlock } from "./ui/AssistPrimitives";
import { fmtAmountShort, fmtStaleness, asScore } from "./cockpit/format";
import { tierDot, signalLabel } from "./deal/SignalsStrip";
import { ui } from "@/lib/brandUi";

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
  return <AssistEmpty>{children || "Nothing computed for this tab yet."}</AssistEmpty>;
}

function OverviewTab({ payload, insight, signals }) {
  const briefing = s(payload.account_level_briefing) || s(payload.brief_summary);
  const summary = s(payload.brief_summary) !== briefing ? s(payload.brief_summary) : null;
  const meta =
    payload.intelligence_layer_meta && typeof payload.intelligence_layer_meta === "object"
      ? payload.intelligence_layer_meta
      : {};
  const rec =
    payload.recommended_next_best_actions && typeof payload.recommended_next_best_actions === "object"
      ? payload.recommended_next_best_actions
      : {};
  if (!briefing && !summary && !s(rec.ae)) return <Empty>No overview computed yet. Run an analysis.</Empty>;
  return (
    <div className="space-y-4">
      {briefing ? <BriefingBlock label="Primary recommendation">{briefing}</BriefingBlock> : null}
      {summary ? (
        <div>
          <SectionTitle>Summary</SectionTitle>
          <p className="text-sm text-brand-stone">{summary}</p>
        </div>
      ) : null}
      {s(rec.ae) ? (
        <div>
          <SectionTitle>Recommended next move</SectionTitle>
          <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
            <InsightRow name={s(rec.ae)} badge={<AssistBadge variant="accent">AE</AssistBadge>} />
            {s(rec.system) ? (
              <InsightRow name={s(rec.system)} badge={<AssistBadge variant="info">System</AssistBadge>} />
            ) : null}
            {s(rec.marketing) ? (
              <InsightRow name={s(rec.marketing)} badge={<AssistBadge variant="ghost">Marketing</AssistBadge>} />
            ) : null}
            {s(rec.cs) ? (
              <InsightRow name={s(rec.cs)} badge={<AssistBadge variant="ghost">CS</AssistBadge>} />
            ) : null}
          </div>
        </div>
      ) : null}
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
    </div>
  );
}

function personaList(payload) {
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
    <div className="space-y-4">
      {contacts.length > 0 ? (
        <div>
          <SectionTitle>Known contacts</SectionTitle>
          <ul className="space-y-2">
            {contacts.map((c) => {
              const bu = c.businessUser ?? {};
              const name = bu.name || bu.email || "Contact";
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-brand-secondary/25 bg-brand-surface px-3 py-2.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-sage/25 text-sm font-semibold text-brand-ink">
                    {initials(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-brand-ink truncate">{name}</p>
                    {bu.jobTitle ? <p className="text-xs text-brand-stone truncate">{bu.jobTitle}</p> : null}
                  </div>
                  {c.persona ? <AssistBadge variant="accent">{c.persona}</AssistBadge> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {personas.length > 0 ? (
        <div>
          <SectionTitle>Persona matches (AURA)</SectionTitle>
          <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
            {personas.map((p, i) => (
              <InsightRow key={i} name={p} badge={<AssistBadge variant="accent">Persona</AssistBadge>} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ValueTab({ payload, deals }) {
  const positives = pluck(payload.positive_outcomes_observed, "outcome");
  const mm =
    payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object"
      ? payload.mental_model_reasoning_summary
      : {};
  const openValue = deals.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  if (!positives.length && !s(payload.net_deal_confidence_uplift) && !openValue) {
    return <Empty>No value drivers computed yet.</Empty>;
  }
  return (
    <div className="space-y-4">
      <SectionTitle>Value snapshot</SectionTitle>
      <KvGrid
        items={[
          { label: "Open pipeline", value: openValue ? fmtAmountShort(openValue) : null },
          { label: "Confidence uplift", value: s(payload.net_deal_confidence_uplift) },
          { label: "Opportunity tradeoff", value: s(mm.opportunity_cost_delta) },
        ]}
      />
      {positives.length > 0 ? (
        <div>
          <SectionTitle>Realized / positive outcomes</SectionTitle>
          <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
            {positives.map((p, i) => (
              <InsightRow key={i} name={p} badge={<AssistBadge variant="ok">Win</AssistBadge>} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RisksTab({ payload }) {
  const warnings = pluck(payload.early_warning_signal, "warning_signal");
  const mm =
    payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object"
      ? payload.mental_model_reasoning_summary
      : {};
  const inversion = s(mm.inversion_risk_detected);
  if (!warnings.length && !inversion) return <Empty>No risks detected yet.</Empty>;
  return (
    <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
      {warnings.map((w, i) => (
        <InsightRow key={i} name={w} badge={<AssistBadge variant="danger">Risk</AssistBadge>} />
      ))}
      {inversion ? (
        <InsightRow name="Likely failure modes" badge={<AssistBadge variant="warn">Inversion</AssistBadge>}>
          {inversion}
        </InsightRow>
      ) : null}
    </div>
  );
}

function ActionsTab({ payload }) {
  const rec =
    payload.recommended_next_best_actions && typeof payload.recommended_next_best_actions === "object"
      ? payload.recommended_next_best_actions
      : {};
  const flow =
    payload.suggested_follow_up_flow && typeof payload.suggested_follow_up_flow === "object"
      ? payload.suggested_follow_up_flow
      : {};
  const rows = [
    s(rec.ae) && { name: s(rec.ae), badge: <AssistBadge variant="danger">AE · P1</AssistBadge> },
    s(rec.system) && { name: s(rec.system), badge: <AssistBadge variant="info">System</AssistBadge> },
    s(rec.marketing) && { name: s(rec.marketing), badge: <AssistBadge variant="ghost">Marketing</AssistBadge> },
    s(rec.cs) && { name: s(rec.cs), badge: <AssistBadge variant="ghost">CS</AssistBadge> },
  ].filter(Boolean);
  const flowRows = [
    s(flow.day_0) && { d: "Day 0", v: s(flow.day_0) },
    s(flow.day_3) && { d: "Day 3", v: s(flow.day_3) },
    s(flow.day_6) && { d: "Day 6", v: s(flow.day_6) },
  ].filter(Boolean);
  if (!rows.length && !flowRows.length) return <Empty>No actions recommended yet.</Empty>;
  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <div>
          <SectionTitle>Recommended actions</SectionTitle>
          <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
            {rows.map((r, i) => (
              <InsightRow key={i} name={r.name} badge={r.badge} />
            ))}
          </div>
        </div>
      ) : null}
      {flowRows.length > 0 ? (
        <div>
          <SectionTitle>Suggested follow-up flow</SectionTitle>
          <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
            {flowRows.map((r, i) => (
              <InsightRow key={i} name={r.d} badge={<AssistBadge variant="accent">{r.d}</AssistBadge>}>
                {r.v}
              </InsightRow>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimelineTab({ payload }) {
  const mm =
    payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object"
      ? payload.mental_model_reasoning_summary
      : {};
  const forecast = s(mm.second_order_forecast);
  const loop = s(mm.feedback_loop_effect);
  const likelihood = s(payload.likelihood_to_progress);
  if (!forecast && !loop && !likelihood) return <Empty>No forecast computed yet.</Empty>;
  return (
    <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
      {likelihood ? (
        <InsightRow name="Likelihood to progress" badge={<AssistBadge variant="ok">{likelihood}</AssistBadge>} />
      ) : null}
      {forecast ? (
        <InsightRow name="Second-order forecast" badge={<AssistBadge variant="info">Forecast</AssistBadge>}>
          {forecast}
        </InsightRow>
      ) : null}
      {loop ? (
        <InsightRow name="Feedback loop effect" badge={<AssistBadge variant="ghost">Loop</AssistBadge>}>
          {loop}
        </InsightRow>
      ) : null}
    </div>
  );
}

function CompetitiveTab({ payload, signals }) {
  const compSignals = signals.filter((sig) =>
    /compet|salesforce|rival|alternative|vs /i.test(`${sig.type || ""} ${sig.headline || ""} ${sig.category || ""}`)
  );
  const mm =
    payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object"
      ? payload.mental_model_reasoning_summary
      : {};
  const bottleneck = s(mm.system_bottleneck_addressed);
  if (!compSignals.length && !bottleneck) return <Empty>No competitive threats detected.</Empty>;
  return (
    <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
      {compSignals.map((sig) => (
        <InsightRow key={sig.id} name={signalLabel(sig)} badge={<AssistBadge variant="warn">Threat</AssistBadge>}>
          {sig.evidence || sig.suggestedAngle}
        </InsightRow>
      ))}
      {bottleneck ? (
        <InsightRow name="System bottleneck" badge={<AssistBadge variant="info">Focus</AssistBadge>}>
          {bottleneck}
        </InsightRow>
      ) : null}
    </div>
  );
}

function ExpansionTab({ payload }) {
  const detected =
    payload.aura_insight_detected && typeof payload.aura_insight_detected === "object"
      ? payload.aura_insight_detected
      : {};
  const paths = arr(detected.gtm_paths_you_can_pursue).filter((p) => p && typeof p === "object");
  if (!paths.length) return <Empty>No expansion vectors identified yet.</Empty>;
  return (
    <div>
      <SectionTitle>Growth vectors</SectionTitle>
      <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
        {paths.map((p, i) => (
          <InsightRow
            key={i}
            name={s(p.title) || `Path ${i + 1}`}
            badge={s(p.score_impact) ? <AssistBadge variant="accent">{s(p.score_impact)}</AssistBadge> : null}
          >
            {s(p.why_this_works)}
            {arr(p.path_steps).length ? ` · ${arr(p.path_steps).filter(Boolean).join(" → ")}` : ""}
          </InsightRow>
        ))}
      </div>
    </div>
  );
}

function ResearchTab({ payload }) {
  const summary = s(payload.brief_summary);
  const coach = s(payload.your_coach_speaks);
  const mm =
    payload.mental_model_reasoning_summary && typeof payload.mental_model_reasoning_summary === "object"
      ? payload.mental_model_reasoning_summary
      : {};
  const root = s(mm.first_principles_target);
  if (!summary && !coach && !root) return <Empty>No research notes computed yet.</Empty>;
  return (
    <div className="space-y-4">
      {summary ? <BriefingBlock label="Summary">{summary}</BriefingBlock> : null}
      {coach ? (
        <BriefingBlock label="Your coach speaks">
          <em>{coach}</em>
        </BriefingBlock>
      ) : null}
      {root ? (
        <div>
          <SectionTitle>First-principles root cause</SectionTitle>
          <p className="text-sm text-brand-stone">{root}</p>
        </div>
      ) : null}
    </div>
  );
}

function SignalsTab({ signals }) {
  if (!signals.length) return <Empty>No signals detected.</Empty>;
  return (
    <div className={`${ui.cardMuted} divide-y divide-brand-secondary/15`}>
      {signals.map((sig) => (
        <InsightRow
          key={sig.id}
          name={signalLabel(sig)}
          badge={
            <AssistBadge variant={tierDot(sig) === "t1" ? "danger" : tierDot(sig) === "t2" ? "warn" : "info"}>
              {typeof sig.score === "number" ? `Score ${sig.score}` : "Signal"}
            </AssistBadge>
          }
        >
          {sig.evidence || sig.suggestedAngle}
        </InsightRow>
      ))}
    </div>
  );
}

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
    <Drawer placement="right" size="xl" isOpen={isOpen} onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent className="!max-w-[720px] !bg-brand-surface">
        <DrawerCloseButton />
        <DrawerHeader className={`${ui.titleSm} text-base !bg-brand-surface border-b border-brand-secondary/25`}>
          <p className={`${ui.label} mb-1 normal-case tracking-wide font-sans`}>
            Account{company.industry ? ` · ${company.industry}` : ""}
            {company.domain ? ` · ${company.domain}` : ""}
          </p>
          <span className="font-serif">{company.name || "Company"}</span>
        </DrawerHeader>

        <DrawerBody className="!bg-brand-surface px-0 pb-6">
          <div className="px-4 py-3 border-b border-brand-secondary/25 bg-brand-bg/50">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className={ui.miniStat}>
                <p className="text-xs text-brand-stone">Health</p>
                <p className="text-sm font-semibold text-brand-ink">{score != null ? `${score} / 100` : "—"}</p>
              </div>
              <div className={ui.miniStat}>
                <p className="text-xs text-brand-stone">Open deals</p>
                <p className="text-sm font-semibold text-brand-ink">{deals.length}</p>
              </div>
              <div className={ui.miniStat}>
                <p className="text-xs text-brand-stone">Signals</p>
                <p className="text-sm font-semibold text-brand-ink">{signals.length}</p>
              </div>
              <div className={ui.miniStat}>
                <p className="text-xs text-brand-stone">Last refresh</p>
                <p className="text-sm font-semibold text-brand-ink">
                  {insight?.computedAt ? fmtStaleness(insight.computedAt) : "Never"}
                </p>
              </div>
            </div>
            <button type="button" className={ui.btnSecondarySurface} onClick={onAnalyze} disabled={analyzing}>
              {analyzing ? "Analyzing…" : insight ? "Re-analyze" : "Analyze"}
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto px-4 py-2 border-b border-brand-secondary/25 no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t
                    ? "bg-brand-dark text-white"
                    : "text-brand-stone hover:bg-brand-bg hover:text-brand-ink"
                }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="px-4 py-4">
            {loading ? (
              <p className={`${ui.body} py-12 text-center`}>Loading company…</p>
            ) : !view ? (
              <Empty>Nothing to show.</Empty>
            ) : !insight && tab !== "Signals" && tab !== "Stakeholders" ? (
              <div className={`${ui.cardSurface} p-8 text-center`}>
                <p className={`${ui.body} mb-4`}>
                  No intelligence yet for {company.name || "this account"}. Run an analysis to populate
                  the briefing, risks, actions and signals.
                </p>
                <button type="button" className={ui.btnPrimary} onClick={onAnalyze} disabled={analyzing}>
                  {analyzing ? "Analyzing…" : "Analyze this account"}
                </button>
              </div>
            ) : (
              TAB_RENDER[tab]
            )}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

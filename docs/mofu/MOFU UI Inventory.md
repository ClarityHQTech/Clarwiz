# MOFU UI — Information Inventory (Zero-Loss Rebuild)

> The new dashboard is a **re-layout, not a feature cut**. Every item below is rendered by
> aura-frontend today and MUST be surfaceable in the new UI. Organized as a **widget catalog**:
> each block = a placeable widget you can position on the composable dashboard.
> Source repo: `aura-frontend`. Backing data → Clarwiz MOFU API (`MOFU_ULTRAPLAN.md` §2 X1).

---

## A. DEAL workspace — `pages/DealInsights2.jsx`

- **W-D1 Deal header/badges:** account_score (X/100), risk_label (Low/Med/High), deal_amount ($),
  new-activity count (+N), last-activity "X ago".
- **W-D2 Account briefing:** account_level_briefing + brief_summary.
- **W-D3 Signals strip:** signal_type badges (Objection, Confusion, Expansion, ChurnRisk,
  DealHealth, Whitespace, Competitive, Integration, RevOps).
- **W-D4 Account-score trend:** line chart over time + delta (↗/↘) + hover tooltip.
- **W-D5 GTM Taskbook:** per path → title, score_impact, path_steps[] (checkable),
  why_this_works; "Add selected as tasks" (idle/loading/success).
- **W-D6 Next Best Actions:** per NBA → signal_reference_id, action_title, signal_score,
  "Draft an email"; optional custom-action card.
- **W-D7 Risks & opportunities:** early_warning_signals[] (warning_signal), Aura insights
  (insight_label + insight_explanation).
- **W-D8 Coaching tip:** coaching_tip.
- **W-D9 Email draft modal:** editable HTML, PDF attachment link, collateral asset link,
  unsaved-changes state, Save.
- **W-D10 Template picker modal:** template.key list + "Skip — generate without template".
- **W-D11 Note dialog:** add note to deal (textarea + save/success).
- **W-D12 New-activity processing toaster.**

## B. COMPANY workspace — `pages/companyInsights/CompanyTest.jsx` (10 tabs)

- **W-C0 Tab nav** (Overview · Stakeholders · Value · Risks · Actions · Timeline · Competitive · Expansion · Research · Signals).
- **W-C1 Overview:** company_name, health_score, risk_level, momentum_direction,
  opportunity_value, primary_recommendation, critical_actions_required[] (priority/action/owner/deadline),
  intelligence_confidence.level + supporting_factors[].
- **W-C2 Stakeholders:** ICP role groups; per stakeholder name/influence_level/engagement_status/engagement_strategy;
  power structure (formal_authority[]/informal_influence[]); coalition alliances (strength + members[]).
- **W-C3 Value:** direct_roi, cost_avoidance, investment_payback; unrealized potential
  (opportunity_area, potential_value, timeline, probability_score, realization_requirements[]).
- **W-C4 Risks:** risk cards (severity, description, probability, root_causes[]); early-warning
  indicators (status + green/yellow/red thresholds + monitoring_frequency); mitigation strategies
  (effectiveness_probability, actions[] with owner/timeline/success_metric).
- **W-C5 Actions:** immediate (priority_score, action, deadline, owner, success_metric,
  risk_if_delayed, resources_required[]); short-term initiatives (success_probability, timeline,
  roi_estimate, expected_outcome, dependencies[]); long-term positioning (expected_roi,
  investment_level, milestones[] with target_date + success_criteria[]).
- **W-C6 Timeline:** scenario analysis (scenario, probability, key_events[]); decision timelines
  (decision_type, estimated_date, confidence); intervention impact; historical patterns
  (pattern_type, frequency, impact_on_current); relationship_evolution; milestone correlations.
- **W-C7 Competitive:** feature differentiation (capability, our_strength, competitor_comparison);
  market position (pricing_position, switching_costs); threat analysis (competitor, threat_level,
  evaluation_stage, mitigation_strategy); market_dynamics[]; differentiation opportunities.
- **W-C8 Expansion:** growth vectors (vector_type, value_potential, probability_score, timeline,
  requirements[]); readiness (budget availability, organizational readiness); strategy sequence
  (step, timeline, rationale, success_criteria[]); resource_requirements[]; risk_mitigation[].
- **W-C9 Research:** web-research title + sections[] (heading/subheading/description/cta[]);
  start/refresh research action.
- **W-C10 Signals:** scan_date, actors_used[]; tier counts (T1/T2/T3); per signal → tier,
  signal_type, headline, suggested_contact_angle; expanded → evidence, source_url, detected_date,
  sla_hours, recommended_action, "Add as HubSpot Task".

## C. COLLATERAL — `tailspin/TailspinDashboard.jsx` + `TailspinCollateral.jsx`

- **W-K1 Stats cards:** products count, prospects total, collaterals total ("N total · M by you").
- **W-K2 Quick actions:** Create Collateral, Brand Assets.
- **W-K3 Collateral directory:** searchable grid → title, creator, description, view_count,
  created_at; pagination.
- **W-K4 Products / Prospects side panels** (list + manage).
- **W-K5 Collateral preview** (rendered template, error states).
- **W-K6 Collateral chat** (history, version status running/done/failed, prompt input, usage indicator).
- **W-K7 Version selector** (status, timestamp, description, current highlight).
- **W-K8 Visual editor / inspector** (element select + property edit).
- **W-K9 Share modals:** shareable link + prospect-only link (domain-verified).
- **W-K10 Compliance modal:** score X/100 + progress bar + assessment note.

## D. BATTLECARD — `components/Battlecard.jsx` (External / Internal toggle)

- **W-B0 Header:** title, version toggle (External/Internal), last-updated.
- **W-B1 External:** executive snapshot (who-they-are, win_reasons, risk_flags, conversation_steers);
  objective comparison (problem_fit, who_benefits, expected_outcomes); capabilities table
  (capability/seller/competitor); integration & security; implementation path (milestones, roles,
  timeline); value/TCO (how value accrues, ROI levers); why-choose-seller.
- **W-B2 Internal:** company overviews (size, GTM, ICP, logos × seller/competitor); product platform
  mapping (modules, features, architecture, integrations); feature-parity table; packaging/pricing
  intel (price pages, enterprise patterns, discount norms, add-on economics, TCO levers, hidden
  costs, lock-ins); security/compliance (SOC2/ISO, residency, SSO/SCIM, audit logs, DLP);
  implementation/TTV; positioning narrative (value frames, traps, counter-positioning); customer
  sentiment (review themes, complaints, quotes); SWOT (seller + competitor + landmines);
  objections & rebuttals (objection/response/proof); trap questions; deal strategy (win/lose, proof
  assets, references, negotiation give-gets/term-levers); risks & mitigations.
- **W-B3 Citations:** [S1]/[S2] hyperlinks → title, publisher, URL.

## E. USER INTELLIGENCE — `tailspin/UserIntelligence.jsx`

- **W-U1 Profile form** (communication style, personality, values) — generate/update/regenerate.
- **W-U2 Intelligence display** (summary, key characteristics, communication-style summary).
- **W-U3 Info box** (how it works / best practices).

## F. GLOBAL chrome (must persist)

- Toasts (success/error/info), loading/spinner states, color-coded badge system,
  modal pattern (overlay/header/close/footer), collapsible section headers,
  comparison tables, citation links, nav/header + account menu.

---

## Coverage rule for the rebuild
The new composable dashboard ships a **widget registry** keyed by the IDs above. "Done" for a
view = every applicable W-* is present (placed or in an overflow/expand), reading from the Clarwiz
MOFU API. Track coverage as a checklist in `MOFU_ULTRAPLAN.md` U2/U3 acceptance.

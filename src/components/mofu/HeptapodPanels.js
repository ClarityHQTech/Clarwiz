"use client";

// Renders the Aura-shaped Heptapod dimensions defensively (falls back gracefully
// when a field is missing). Used by the Deal & Company Insights pages.

const ROLE_COLOR = { decision_maker: "#7e8f6e", economic_buyer: "#7e8f6e", champion: "#bf8a6f", technical: "#8b9a9c", influencer: "#8b9a9c", user: "#9a8d7c" };
const STRENGTH_BADGE = { superior: "green", equal: "gray", weaker: "amber" };
const SEV_BADGE = { high: "red", critical: "red", medium: "amber", low: "green" };
const STATUS_DOT = { green: "#7e8f6e", yellow: "#c2962f", red: "#c0726a" };

function initials(n) { return (n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
const txt = (v) => (v == null || v === "" ? "—" : String(v));
function Empty({ what }) { return <p className="muted">No {what} captured yet — click Suggest now to (re)compute.</p>; }

function StatTile({ label, value }) {
  return (
    <div style={{ background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 16, fontWeight: 760, color: "var(--accent-ink)" }}>{txt(value)}</div>
      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
    </div>
  );
}
function Bar({ label, value, pct }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div style={{ margin: "9px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{label}</span><b>{txt(value)}</b></div>
      <div style={{ height: 7, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${p}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }} /></div>
    </div>
  );
}

export default function HeptapodPanel({ tab, insight, contacts = [], signals = [], onContactClick }) {
  const exec = insight?.executiveSummary ?? {};
  const dims = insight?.dimensions ?? {};

  if (tab === "overview") {
    const av = exec.account_status_vector ?? {};
    const crit = Array.isArray(exec.critical_actions_required) ? exec.critical_actions_required : [];
    return (
      <div>
        <div style={{ background: "var(--accent-soft)", border: "1px solid #e6d6c4", borderRadius: 11, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 750, fontSize: 13, color: "var(--accent-ink)", marginBottom: 8 }}>⚡ Executive intelligence summary</div>
          {exec.primary_recommendation ? <p style={{ fontSize: 13, color: "var(--text)" }}>{exec.primary_recommendation}</p> : <Empty what="summary" />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          <StatTile label="Health" value={av.health_score} />
          <StatTile label="Risk level" value={av.risk_level} />
          <StatTile label="Momentum" value={av.momentum_direction} />
          <StatTile label="Opportunity" value={av.opportunity_value} />
        </div>
        {crit.length > 0 && (
          <div>
            <div className="cap-note" style={{ marginBottom: 8 }}><span className="tag">critical actions</span></div>
            {crit.map((c, i) => (
              <div className="risk" key={i} style={{ borderLeftColor: SEV_BADGE[c.priority] === "red" ? "var(--red)" : "var(--amber)" }}>
                <div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className={`badge ${SEV_BADGE[c.priority] || "gray"}`}>{txt(c.priority)}</span><h4>{txt(c.action)}</h4></div><p>Owner {txt(c.owner)} · {txt(c.deadline)}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tab === "stakeholder") {
    const profiles = dims.stakeholder?.individual_profiles ?? [];
    // Merge AI stakeholder profiles with HubSpot contacts by name.
    const byName = new Map(profiles.map((p) => [String(p.name || "").toLowerCase(), p]));
    const rows = contacts.map((c) => ({ ...c, ai: byName.get(String(c.name || "").toLowerCase()) }));
    const aiOnly = profiles.filter((p) => !contacts.find((c) => String(c.name || "").toLowerCase() === String(p.name || "").toLowerCase()));
    const all = [...rows, ...aiOnly.map((p) => ({ id: p.name, name: p.name, title: p.role_type, email: null, ai: p }))];
    if (!all.length) return <Empty what="stakeholders" />;
    return (
      <div>
        {all.map((c) => {
          const role = c.ai?.role_type || c.persona || "contact";
          const clickable = !!(onContactClick && c.email);
          return (
            <div
              className="person"
              key={c.id || c.name}
              onClick={clickable ? () => onContactClick(c) : undefined}
              style={clickable ? { cursor: "pointer" } : undefined}
              title={clickable ? "View contact" : undefined}
            >
              <div className="pa" style={{ background: ROLE_COLOR[role] || "#bf8a6f" }}>{initials(c.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="pn">{txt(c.name)}</div>
                <div className="pr">{txt(c.title || c.ai?.role_type)}{c.email ? ` · ${c.email}` : ""}</div>
                {c.ai?.engagement_strategy && <div className="pr" style={{ marginTop: 2 }}>↳ {c.ai.engagement_strategy}</div>}
              </div>
              <div className="pright">
                <span className="badge gray">{String(role).replace("_", " ")}</span>
                {c.ai?.engagement_status && <div className="muted" style={{ marginTop: 3 }}>{c.ai.engagement_status}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (tab === "value") {
    const ev = dims.value?.realized_value?.economic_value ?? {};
    const unreal = dims.value?.unrealized_potential ?? [];
    const hasEv = ev.direct_roi || ev.cost_avoidance || ev.investment_payback;
    if (!hasEv && !unreal.length) return <Empty what="value intelligence" />;
    return (
      <div>
        {hasEv && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
            <StatTile label="Direct ROI" value={ev.direct_roi} />
            <StatTile label="Cost avoidance" value={ev.cost_avoidance} />
            <StatTile label="Payback" value={ev.investment_payback} />
          </div>
        )}
        {unreal.map((u, i) => <Bar key={i} label={txt(u.opportunity_area)} value={u.potential_value} pct={u.probability_score} />)}
      </div>
    );
  }

  if (tab === "risk") {
    const risks = dims.risk?.risk_assessment ?? [];
    const ewi = dims.risk?.early_warning_indicators ?? [];
    if (!risks.length && !ewi.length) return <Empty what="risks" />;
    return (
      <div>
        {risks.map((r, i) => (
          <div className="risk" key={i} style={{ borderLeftColor: SEV_BADGE[r.severity_level] === "red" ? "var(--red)" : SEV_BADGE[r.severity_level] === "green" ? "var(--green)" : "var(--amber)" }}>
            <div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className={`badge ${SEV_BADGE[r.severity_level] || "gray"}`}>{txt(r.severity_level)}</span><h4>{txt(r.description)}</h4></div>{r.probability != null && <p>Probability {r.probability}%{Array.isArray(r.root_causes) && r.root_causes.length ? ` · ${r.root_causes.join(", ")}` : ""}</p>}</div>
          </div>
        ))}
        {ewi.map((e, i) => (
          <div key={`e${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_DOT[e.current_status] || "#ccc" }} />{txt(e.indicator)}
          </div>
        ))}
      </div>
    );
  }

  if (tab === "temporal") {
    const dt = dims.temporal?.future_projections?.decision_timelines ?? [];
    const tm = dims.temporal?.future_projections?.trajectory_models ?? [];
    const kp = dims.temporal?.historical_context?.key_patterns ?? [];
    if (!dt.length && !tm.length && !kp.length) return <Empty what="timeline" />;
    return (
      <div>
        {dt.map((d, i) => (
          <div className="dim-row" key={i}><div className="dim-ico">◷</div><div><h4>{txt(d.decision_type)}</h4><p>{txt(d.estimated_date)}{d.confidence != null ? ` · ${d.confidence}% confidence` : ""}</p></div></div>
        ))}
        {tm.map((t, i) => (
          <div className="dim-row" key={`t${i}`}><div className="dim-ico">↗</div><div><h4>{txt(t.scenario)}</h4><p>{t.probability != null ? `${t.probability}% · ` : ""}{txt(t.timeline)}</p></div></div>
        ))}
        {kp.map((p, i) => (
          <div className="dim-row" key={`p${i}`}><div className="dim-ico">≈</div><div><h4>{txt(p.pattern_type)}</h4><p>{txt(p.description)}</p></div></div>
        ))}
      </div>
    );
  }

  if (tab === "competitive") {
    const fd = dims.competitive?.position_assessment?.feature_differentiation ?? [];
    const ev = dims.competitive?.threat_analysis?.active_evaluations ?? [];
    const diff = dims.competitive?.differentiation_opportunities ?? [];
    if (!fd.length && !ev.length && !diff.length) return <Empty what="competitive intelligence" />;
    return (
      <div>
        {fd.length > 0 && (
          <table><thead><tr><th>Capability</th><th>Us</th><th>Comparison</th></tr></thead><tbody>
            {fd.map((f, i) => <tr key={i}><td>{txt(f.capability)}</td><td><span className={`badge ${STRENGTH_BADGE[f.our_strength] || "gray"}`}>{txt(f.our_strength)}</span></td><td className="muted">{txt(f.competitor_comparison)}</td></tr>)}
          </tbody></table>
        )}
        {ev.map((e, i) => (
          <div className="risk" key={`e${i}`} style={{ marginTop: 10, borderLeftColor: SEV_BADGE[e.threat_level] === "red" ? "var(--red)" : "var(--amber)" }}><div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className={`badge ${SEV_BADGE[e.threat_level] || "gray"}`}>{txt(e.threat_level)}</span><h4>{txt(e.competitor)}</h4></div><p>{txt(e.evaluation_stage)}</p></div></div>
        ))}
        {diff.map((d, i) => <div className="dim-row" key={`d${i}`} style={{ marginTop: 10 }}><div className="dim-ico">✦</div><div><h4>{txt(d.opportunity)}</h4><p>{txt(d.competitive_advantage)}</p></div></div>)}
      </div>
    );
  }

  if (tab === "expansion") {
    const gv = dims.expansion?.growth_vectors ?? [];
    if (!gv.length) return <Empty what="expansion intelligence" />;
    return (
      <div>
        {gv.map((g, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <Bar label={`${txt(g.vector_type)} · ${txt(g.value_potential)}`} value={g.value_potential} pct={g.probability_score} />
            {g.opportunity_description && <p className="muted" style={{ marginTop: 2 }}>{g.opportunity_description}</p>}
          </div>
        ))}
      </div>
    );
  }

  if (tab === "signals") {
    if (!signals.length) return <Empty what="signals" />;
    return (
      <div className="feed">
        {signals.map((sg) => (
          <div className="feed-i" key={sg.id}>
            <div className="feed-ic fi-sig">∿</div>
            <div><div className="ft"><b>{sg.kind?.replace("_", " ")}</b></div><div className="fm">{sg.summary || sg.signalReferenceId}</div></div>
            <div className="fr"><span className="badge blue">score {Number(sg.score).toFixed(2)}</span></div>
          </div>
        ))}
      </div>
    );
  }
  return <Empty what="data" />;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";
import { CkCard, CkBadge } from "@/components/assist/cockpit/primitives";

const EMPTY_FORM = {
  hubspotToken: "",
  hubspotPortalId: "",
  defaultOwnerId: "",
  insightModel: "",
  singleSendEmailId: "",
};

const EMPTY_BRAND = {
  primary: "#1F2937",
  accent: "#F2A65A",
  fontHeading: "Instrument Serif",
  fontBody: "Inter",
  logoUrl: "",
  tagline: "",
};

function statusBadge(integration, loading) {
  if (loading) return <CkBadge variant="ghost">Checking…</CkBadge>;
  if (!integration?.configured) return <CkBadge variant="ghost">Not configured</CkBadge>;
  if (integration.status === "connected") return <CkBadge variant="ok">Connected</CkBadge>;
  if (integration.status === "error") return <CkBadge variant="danger">Test failed</CkBadge>;
  return <CkBadge variant="warn">Pending</CkBadge>;
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="ck-kv-label" style={{ marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: "var(--accent)" }}> *</span>}
      </div>
      {children}
    </div>
  );
}

function MofuSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState({ configured: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [brand, setBrand] = useState(EMPTY_BRAND);
  const [savingBrand, setSavingBrand] = useState(false);
  const [showPatForm, setShowPatForm] = useState(false);
  const [savingSingleSend, setSavingSingleSend] = useState(false);
  const [internalDomainsText, setInternalDomainsText] = useState("");
  const [detectedDomains, setDetectedDomains] = useState([]);
  const [savingDomains, setSavingDomains] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes, dRes] = await Promise.all([
        fetch("/api/assist/settings"),
        fetch("/api/assist/brand"),
        fetch("/api/assist/internal-domains"),
      ]);
      const sData = await sRes.json();
      const integ = sData.integration ?? { configured: false };
      setIntegration(integ);
      // Seed the Single Send email ID so it survives a re-save (it is not a secret).
      if (integ.singleSendEmailId) {
        setForm((f) => ({ ...f, singleSendEmailId: String(integ.singleSendEmailId) }));
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData.brand) {
          setBrand({
            primary: bData.brand.primary ?? EMPTY_BRAND.primary,
            accent: bData.brand.accent ?? EMPTY_BRAND.accent,
            fontHeading: bData.brand.fontHeading ?? EMPTY_BRAND.fontHeading,
            fontBody: bData.brand.fontBody ?? EMPTY_BRAND.fontBody,
            logoUrl: bData.brand.logoUrl ?? "",
            tagline: bData.brand.tagline ?? "",
          });
        }
      }
      if (dRes.ok) {
        const dData = await dRes.json();
        setInternalDomainsText((dData.configured ?? []).join("\n"));
        setDetectedDomains(dData.detected ?? []);
      }
    } catch {
      toast.error("Failed to load MOFU settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the result of the HubSpot OAuth round-trip (?hubspot=… on return).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("hubspot");
    if (!status) return;
    if (status === "connected") toast.success("HubSpot connected via OAuth");
    else if (status === "denied") toast.error("HubSpot connection was denied");
    else if (status === "badstate") toast.error("HubSpot connection expired — please try again");
    else if (status === "error") toast.error("HubSpot connection failed — please try again");
    // Clean the query so a refresh doesn't re-toast.
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const connectHubspot = () => {
    window.location.href = "/api/assist/hubspot/oauth/start";
  };

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.hubspotToken.trim()) {
      toast.error("HubSpot token is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/assist/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      setIntegration(data.integration);
      setForm((f) => ({ ...f, hubspotToken: "" })); // never keep the raw token in state
      if (data.verified?.hubspot) {
        toast.success("HubSpot connected");
      } else {
        toast.warning("Saved, but the HubSpot test failed — check the token and scopes");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onSaveSingleSend = async (e) => {
    e.preventDefault();
    setSavingSingleSend(true);
    try {
      const res = await fetch("/api/assist/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ singleSendEmailId: form.singleSendEmailId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save email sending settings");
        return;
      }
      setIntegration(data.integration);
      toast.success(
        data.integration?.canDeliverEmail
          ? "Single Send email ID saved — emails will now be delivered"
          : "Single Send cleared — emails will be logged to the timeline only"
      );
    } catch {
      toast.error("Could not save email sending settings");
    } finally {
      setSavingSingleSend(false);
    }
  };

  const onBrandChange = (key) => (e) => setBrand((b) => ({ ...b, [key]: e.target.value }));

  const onSaveBrand = async (e) => {
    e.preventDefault();
    setSavingBrand(true);
    try {
      const res = await fetch("/api/assist/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save brand");
        return;
      }
      if (data.brand) {
        setBrand({
          primary: data.brand.primary ?? EMPTY_BRAND.primary,
          accent: data.brand.accent ?? EMPTY_BRAND.accent,
          fontHeading: data.brand.fontHeading ?? EMPTY_BRAND.fontHeading,
          fontBody: data.brand.fontBody ?? EMPTY_BRAND.fontBody,
          logoUrl: data.brand.logoUrl ?? "",
          tagline: data.brand.tagline ?? "",
        });
      }
      toast.success("Brand saved");
    } catch {
      toast.error("Could not save brand");
    } finally {
      setSavingBrand(false);
    }
  };

  const parseDomains = (text) =>
    text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const onSaveDomains = async (e) => {
    e.preventDefault();
    setSavingDomains(true);
    try {
      const res = await fetch("/api/assist/internal-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: parseDomains(internalDomainsText) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save internal domains");
        return;
      }
      setInternalDomainsText((data.configured ?? []).join("\n"));
      setDetectedDomains(data.detected ?? []);
      toast.success("Internal domains saved");
    } catch {
      toast.error("Could not save internal domains");
    } finally {
      setSavingDomains(false);
    }
  };

  const onCleanupNoise = async () => {
    setCleaning(true);
    try {
      // Preview first so the AE confirms against a real candidate count.
      const dryRes = await fetch("/api/assist/cleanup-noise?dryRun=1", { method: "POST" });
      const dry = await dryRes.json();
      if (!dryRes.ok) {
        toast.error(dry.error || "Could not preview cleanup");
        return;
      }
      const count = dry.candidates?.length ?? 0;
      if (count === 0) {
        toast.success("No noise companies to remove — you're all clean");
        return;
      }
      const names = (dry.candidates ?? [])
        .slice(0, 8)
        .map((c) => c.domain || c.name)
        .join(", ");
      const ok = window.confirm(
        `Remove ${count} noise compan${count === 1 ? "y" : "ies"}?\n\n` +
          `${names}${count > 8 ? ", …" : ""}\n\n` +
          "These are internal or empty email-noise records with no deals. Accounts with deals are never touched. This cannot be undone."
      );
      if (!ok) return;
      const res = await fetch("/api/assist/cleanup-noise", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Cleanup failed");
        return;
      }
      toast.success(
        `Removed ${data.deleted} noise compan${data.deleted === 1 ? "y" : "ies"}`
      );
    } catch {
      toast.error("Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <AssistShell active="settings" crumbs={["Settings"]}>
      <div className="ck-page-header">
        <div className="ck-page-title-block">
          <div className="ck-eyebrow">Integrations · Credentials</div>
          <h1 className="ck-page-title">
            AE Assist — <em>Settings</em>
          </h1>
          <p className="ck-page-subtitle">
            Connect HubSpot so the assist layer can read your deals, companies, and contacts.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <CkCard title="HubSpot" action={statusBadge(integration, loading)}>
          {integration.connectionMode === "oauth" && integration.configured ? (
            <div className="ck-kv-label" style={{ marginBottom: 16 }}>
              Connected via OAuth · Portal {integration.hubspotPortalId || "—"} ·{" "}
              {integration.scopeCount ?? 0} scopes
            </div>
          ) : (
            <p className="ck-kv-label" style={{ marginBottom: 16 }}>
              Install the Clarwiz app into your HubSpot portal to grant access — no token to
              paste.
            </p>
          )}

          <button type="button" className="ck-btn ck-btn-primary" onClick={connectHubspot}>
            {integration.connectionMode === "oauth" && integration.configured
              ? "Reconnect HubSpot"
              : "Connect HubSpot"}
          </button>

          <div style={{ marginTop: 20, borderTop: "1px solid var(--border, #333)", paddingTop: 12 }}>
            <button
              type="button"
              className="ck-btn"
              onClick={() => setShowPatForm((v) => !v)}
              style={{ marginBottom: showPatForm ? 16 : 0 }}
            >
              {showPatForm ? "Hide" : "Advanced: use a private-app token instead"}
            </button>

            {showPatForm && (
              <>
                {integration.configured && integration.connectionMode !== "oauth" && (
                  <div className="ck-kv-label" style={{ marginBottom: 16 }}>
                    Token {integration.hubspotTokenMasked} · Portal{" "}
                    {integration.hubspotPortalId || "—"}
                  </div>
                )}
                <form onSubmit={onSave}>
                  <Field label="HubSpot private-app token" required>
                    <input
                      className="ck-input"
                      type="password"
                      placeholder="pat-naX-…"
                      autoComplete="off"
                      value={form.hubspotToken}
                      onChange={onChange("hubspotToken")}
                    />
                  </Field>
                  <Field label="Portal ID (optional)">
                    <input className="ck-input" value={form.hubspotPortalId} onChange={onChange("hubspotPortalId")} />
                  </Field>
                  <Field label="Default owner ID (optional)">
                    <input className="ck-input" value={form.defaultOwnerId} onChange={onChange("defaultOwnerId")} />
                  </Field>
                  <Field label="Insight model (optional)">
                    <input
                      className="ck-input"
                      placeholder="gpt-4o"
                      value={form.insightModel}
                      onChange={onChange("insightModel")}
                    />
                  </Field>
                  <Field label="Single Send email ID (optional)">
                    <input
                      className="ck-input"
                      inputMode="numeric"
                      placeholder="e.g. 12345678"
                      value={form.singleSendEmailId}
                      onChange={onChange("singleSendEmailId")}
                    />
                  </Field>
                  <button type="submit" className="ck-btn ck-btn-primary" disabled={saving}>
                    {saving ? "Saving…" : integration.configured ? "Update" : "Save & verify"}
                  </button>
                </form>
              </>
            )}
          </div>
        </CkCard>

        <CkCard
          title="Email sending"
          style={{ marginTop: 20 }}
          action={
            integration.canDeliverEmail ? (
              <CkBadge variant="ok">Delivers</CkBadge>
            ) : (
              <CkBadge variant="ghost">Timeline only</CkBadge>
            )
          }
        >
          <p className="ck-kv-label" style={{ marginBottom: 16 }}>
            Create a transactional email in HubSpot (Save for Single Send API) with{" "}
            <code>{"{{ custom.subject }}"}</code> and <code>{"{{ custom.body }}"}</code> tokens,
            paste its email ID here. With no ID, NBA emails are logged to the deal/contact timeline
            instead of being delivered.
          </p>
          <form onSubmit={onSaveSingleSend}>
            <Field label="Single Send email ID">
              <input
                className="ck-input"
                inputMode="numeric"
                placeholder="e.g. 12345678"
                value={form.singleSendEmailId}
                onChange={onChange("singleSendEmailId")}
              />
            </Field>
            <button type="submit" className="ck-btn ck-btn-primary" disabled={savingSingleSend}>
              {savingSingleSend ? "Saving…" : "Save"}
            </button>
          </form>
        </CkCard>

        <CkCard title="Brand" style={{ marginTop: 20 }}>
          <p className="ck-kv-label" style={{ marginBottom: 16 }}>
            The brand the renderer and personalization use for collateral. Bake these into your
            templates.
          </p>
          <form onSubmit={onSaveBrand}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Primary color">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={brand.primary || "#1F2937"}
                    onChange={onBrandChange("primary")}
                    style={{ width: 44, height: 38, padding: 2, borderRadius: 8, border: "1px solid var(--border, #333)", background: "transparent" }}
                    aria-label="Primary color"
                  />
                  <input className="ck-input" value={brand.primary} onChange={onBrandChange("primary")} placeholder="#1F2937" />
                </div>
              </Field>
              <Field label="Accent color">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={brand.accent || "#F2A65A"}
                    onChange={onBrandChange("accent")}
                    style={{ width: 44, height: 38, padding: 2, borderRadius: 8, border: "1px solid var(--border, #333)", background: "transparent" }}
                    aria-label="Accent color"
                  />
                  <input className="ck-input" value={brand.accent} onChange={onBrandChange("accent")} placeholder="#F2A65A" />
                </div>
              </Field>
              <Field label="Heading font">
                <input className="ck-input" value={brand.fontHeading} onChange={onBrandChange("fontHeading")} placeholder="Instrument Serif" />
              </Field>
              <Field label="Body font">
                <input className="ck-input" value={brand.fontBody} onChange={onBrandChange("fontBody")} placeholder="Inter" />
              </Field>
            </div>
            <Field label="Logo URL">
              <input className="ck-input" value={brand.logoUrl} onChange={onBrandChange("logoUrl")} placeholder="https://…/logo.png" />
            </Field>
            <Field label="Company one-liner">
              <input className="ck-input" value={brand.tagline} onChange={onBrandChange("tagline")} placeholder="What your company does, in one line" />
            </Field>
            <button type="submit" className="ck-btn ck-btn-primary" disabled={savingBrand}>
              {savingBrand ? "Saving…" : "Save brand"}
            </button>
          </form>
        </CkCard>

        <CkCard title="Internal domains" style={{ marginTop: 20 }}>
          <p className="ck-kv-label" style={{ marginBottom: 16 }}>
            Contacts at these domains are treated as your own team — hidden from leads and never
            made into prospect companies. Add any extra company domains you own (e.g.{" "}
            <code>clarityhq.ai</code>), one per line or comma-separated.
          </p>
          <form onSubmit={onSaveDomains}>
            <Field label="Your company domains">
              <textarea
                className="ck-input"
                rows={4}
                placeholder={"clarityhq.ai\nacme.com"}
                value={internalDomainsText}
                onChange={(e) => setInternalDomainsText(e.target.value)}
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </Field>
            <div className="ck-kv-label" style={{ marginBottom: 16 }}>
              Auto-detected from your team&apos;s logins:{" "}
              {detectedDomains.length ? (
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, marginLeft: 4 }}>
                  {detectedDomains.map((d) => (
                    <CkBadge key={d} variant="ghost">
                      {d}
                    </CkBadge>
                  ))}
                </span>
              ) : (
                <span style={{ opacity: 0.7 }}>none</span>
              )}
            </div>
            <button type="submit" className="ck-btn ck-btn-primary" disabled={savingDomains}>
              {savingDomains ? "Saving…" : "Save internal domains"}
            </button>
          </form>

          <div
            style={{ marginTop: 20, borderTop: "1px solid var(--border, #333)", paddingTop: 16 }}
          >
            <div className="ck-kv-label" style={{ marginBottom: 8 }}>
              Clean up noise companies
            </div>
            <p className="ck-kv-label" style={{ marginBottom: 12, opacity: 0.85 }}>
              Remove already-synced internal and empty email-noise company records that have no
              deals. Accounts with deals are never touched. You&apos;ll see a count to confirm first.
            </p>
            <button
              type="button"
              className="ck-btn"
              onClick={onCleanupNoise}
              disabled={cleaning}
            >
              {cleaning ? "Working…" : "Clean up noise companies"}
            </button>
          </div>
        </CkCard>
      </div>
    </AssistShell>
  );
}

export default DashboardLayout()(MofuSettingsPage);

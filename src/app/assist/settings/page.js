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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        fetch("/api/assist/settings"),
        fetch("/api/assist/brand"),
      ]);
      const sData = await sRes.json();
      setIntegration(sData.integration ?? { configured: false });
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
    } catch {
      toast.error("Failed to load MOFU settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          {integration.configured && (
            <div className="ck-kv-label" style={{ marginBottom: 16 }}>
              Token {integration.hubspotTokenMasked} · Portal {integration.hubspotPortalId || "—"}
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
            <button type="submit" className="ck-btn ck-btn-primary" disabled={saving}>
              {saving ? "Saving…" : integration.configured ? "Update" : "Save & verify"}
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
      </div>
    </AssistShell>
  );
}

export default DashboardLayout()(MofuSettingsPage);

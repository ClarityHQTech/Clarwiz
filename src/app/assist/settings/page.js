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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assist/settings");
      const data = await res.json();
      setIntegration(data.integration ?? { configured: false });
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
      </div>
    </AssistShell>
  );
}

export default DashboardLayout()(MofuSettingsPage);

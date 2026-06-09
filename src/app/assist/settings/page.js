"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistBadge from "@/components/assist/ui/AssistBadge";
import { ui } from "@/lib/brandUi";

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
  if (loading) return <AssistBadge variant="ghost">Checking…</AssistBadge>;
  if (!integration?.configured) return <AssistBadge variant="ghost">Not configured</AssistBadge>;
  if (integration.status === "connected") return <AssistBadge variant="ok">Connected</AssistBadge>;
  if (integration.status === "error") return <AssistBadge variant="danger">Test failed</AssistBadge>;
  return <AssistBadge variant="warn">Pending</AssistBadge>;
}

function SettingsSection({ title, description, action, children }) {
  return (
    <section className={`${ui.cardSurface} p-4 sm:p-5 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`${ui.titleSm} text-base`}>{title}</h2>
          {description ? <p className="text-sm text-brand-stone mt-1">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
      {children}
      {required ? <span className="text-brand-terracotta"> *</span> : null}
    </label>
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("hubspot");
    if (!status) return;
    if (status === "connected") toast.success("HubSpot connected via OAuth");
    else if (status === "denied") toast.error("HubSpot connection was denied");
    else if (status === "badstate") toast.error("HubSpot connection expired — please try again");
    else if (status === "error") toast.error("HubSpot connection failed — please try again");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const connectHubspot = () => {
    window.location.href = "/api/assist/hubspot/oauth/start";
  };

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const onBrandChange = (key) => (e) => setBrand((b) => ({ ...b, [key]: e.target.value }));

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
      setForm((f) => ({ ...f, hubspotToken: "" }));
      if (data.verified?.hubspot) toast.success("HubSpot connected");
      else toast.warning("Saved, but the HubSpot test failed — check the token and scopes");
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
      toast.success(`Removed ${data.deleted} noise compan${data.deleted === 1 ? "y" : "ies"}`);
    } catch {
      toast.error("Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className={`${ui.page} ${ui.container}`}>
        <p className={ui.body}>Loading settings…</p>
      </div>
    );
  }

  return (
    <div className={`${ui.page} ${ui.container} space-y-6 max-w-3xl`}>
      <Link href="/assist" className={`inline-flex items-center gap-1 ${ui.link}`}>
        <HiOutlineArrowLeft className="h-4 w-4" />
        AE Assist
      </Link>

      <div>
        <h1 className={ui.title}>AE Assist settings</h1>
        <p className={ui.subtitle}>
          Connect HubSpot so the assist layer can read your deals, companies, and contacts.
        </p>
      </div>

      <SettingsSection title="HubSpot" action={statusBadge(integration, loading)}>
        {integration.connectionMode === "oauth" && integration.configured ? (
          <p className={ui.body}>
            Connected via OAuth · Portal {integration.hubspotPortalId || "—"} ·{" "}
            {integration.scopeCount ?? 0} scopes
          </p>
        ) : (
          <p className={ui.body}>
            Install the Clarwiz app into your HubSpot portal to grant access — no token to paste.
          </p>
        )}

        <button type="button" className={ui.btnPrimary} onClick={connectHubspot}>
          {integration.connectionMode === "oauth" && integration.configured
            ? "Reconnect HubSpot"
            : "Connect HubSpot"}
        </button>

        <div className="pt-4 border-t border-brand-secondary/25">
          <button type="button" className={ui.btnSecondary} onClick={() => setShowPatForm((v) => !v)}>
            {showPatForm ? "Hide" : "Advanced: use a private-app token instead"}
          </button>

          {showPatForm ? (
            <form onSubmit={onSave} className="mt-4 space-y-4">
              {integration.configured && integration.connectionMode !== "oauth" ? (
                <p className={ui.body}>
                  Token {integration.hubspotTokenMasked} · Portal {integration.hubspotPortalId || "—"}
                </p>
              ) : null}
              <div>
                <FieldLabel required>HubSpot private-app token</FieldLabel>
                <input
                  className={ui.inputSurface}
                  type="password"
                  placeholder="pat-naX-…"
                  autoComplete="off"
                  value={form.hubspotToken}
                  onChange={onChange("hubspotToken")}
                />
              </div>
              <div>
                <FieldLabel>Portal ID (optional)</FieldLabel>
                <input className={ui.inputSurface} value={form.hubspotPortalId} onChange={onChange("hubspotPortalId")} />
              </div>
              <div>
                <FieldLabel>Default owner ID (optional)</FieldLabel>
                <input className={ui.inputSurface} value={form.defaultOwnerId} onChange={onChange("defaultOwnerId")} />
              </div>
              <div>
                <FieldLabel>Insight model (optional)</FieldLabel>
                <input className={ui.inputSurface} placeholder="gpt-4o" value={form.insightModel} onChange={onChange("insightModel")} />
              </div>
              <button type="submit" className={ui.btnPrimary} disabled={saving}>
                {saving ? "Saving…" : integration.configured ? "Update" : "Save & verify"}
              </button>
            </form>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Email sending"
        description="Create a transactional email in HubSpot (Save for Single Send API) with {{ custom.subject }} and {{ custom.body }} tokens. With no ID, NBA emails are logged to the timeline instead of being delivered."
        action={
          integration.canDeliverEmail ? (
            <AssistBadge variant="ok">Delivers</AssistBadge>
          ) : (
            <AssistBadge variant="ghost">Timeline only</AssistBadge>
          )
        }
      >
        <form onSubmit={onSaveSingleSend} className="space-y-4">
          <div>
            <FieldLabel>Single Send email ID</FieldLabel>
            <input
              className={ui.inputSurface}
              inputMode="numeric"
              placeholder="e.g. 12345678"
              value={form.singleSendEmailId}
              onChange={onChange("singleSendEmailId")}
            />
          </div>
          <button type="submit" className={ui.btnPrimary} disabled={savingSingleSend}>
            {savingSingleSend ? "Saving…" : "Save"}
          </button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Brand"
        description="The brand the renderer and personalization use for collateral. Bake these into your templates."
      >
        <form onSubmit={onSaveBrand} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Primary color</FieldLabel>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brand.primary || "#1F2937"}
                  onChange={onBrandChange("primary")}
                  className="h-10 w-12 rounded-lg border border-brand-secondary/40"
                  aria-label="Primary color"
                />
                <input className={ui.inputSurface} value={brand.primary} onChange={onBrandChange("primary")} />
              </div>
            </div>
            <div>
              <FieldLabel>Accent color</FieldLabel>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brand.accent || "#F2A65A"}
                  onChange={onBrandChange("accent")}
                  className="h-10 w-12 rounded-lg border border-brand-secondary/40"
                  aria-label="Accent color"
                />
                <input className={ui.inputSurface} value={brand.accent} onChange={onBrandChange("accent")} />
              </div>
            </div>
            <div>
              <FieldLabel>Heading font</FieldLabel>
              <input className={ui.inputSurface} value={brand.fontHeading} onChange={onBrandChange("fontHeading")} />
            </div>
            <div>
              <FieldLabel>Body font</FieldLabel>
              <input className={ui.inputSurface} value={brand.fontBody} onChange={onBrandChange("fontBody")} />
            </div>
          </div>
          <div>
            <FieldLabel>Logo URL</FieldLabel>
            <input className={ui.inputSurface} value={brand.logoUrl} onChange={onBrandChange("logoUrl")} placeholder="https://…/logo.png" />
          </div>
          <div>
            <FieldLabel>Company one-liner</FieldLabel>
            <input className={ui.inputSurface} value={brand.tagline} onChange={onBrandChange("tagline")} />
          </div>
          <button type="submit" className={ui.btnPrimary} disabled={savingBrand}>
            {savingBrand ? "Saving…" : "Save brand"}
          </button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Internal domains"
        description="Contacts at these domains are treated as your own team — hidden from leads and never made into prospect companies."
      >
        <form onSubmit={onSaveDomains} className="space-y-4">
          <div>
            <FieldLabel>Your company domains</FieldLabel>
            <textarea
              className={`${ui.inputSurface} resize-y`}
              rows={4}
              placeholder={"clarityhq.ai\nacme.com"}
              value={internalDomainsText}
              onChange={(e) => setInternalDomainsText(e.target.value)}
            />
          </div>
          <p className={ui.body}>
            Auto-detected from your team&apos;s logins:{" "}
            {detectedDomains.length ? (
              <span className="inline-flex flex-wrap gap-1.5 ml-1">
                {detectedDomains.map((d) => (
                  <AssistBadge key={d} variant="ghost">
                    {d}
                  </AssistBadge>
                ))}
              </span>
            ) : (
              "none"
            )}
          </p>
          <button type="submit" className={ui.btnPrimary} disabled={savingDomains}>
            {savingDomains ? "Saving…" : "Save internal domains"}
          </button>
        </form>

        <div className="pt-4 border-t border-brand-secondary/25 space-y-3">
          <h3 className={`${ui.titleSm} text-base`}>Clean up noise companies</h3>
          <p className={ui.body}>
            Remove already-synced internal and empty email-noise company records that have no deals.
            Accounts with deals are never touched. You&apos;ll see a count to confirm first.
          </p>
          <button type="button" className={ui.btnSecondary} onClick={onCleanupNoise} disabled={cleaning}>
            {cleaning ? "Working…" : "Clean up noise companies"}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}

export default DashboardLayout()(MofuSettingsPage);

"use client";

import { useEffect, useState } from "react";
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineClipboardCopy,
} from "react-icons/hi";
import { toast } from "sonner";
import IntegrationStatusBadge from "@/components/settings/IntegrationStatusBadge";

const PROVIDER_OPTIONS = [
  { id: "GMAIL", label: "Gmail / Google Workspace" },
  { id: "OUTLOOK", label: "Outlook / Microsoft 365" },
  { id: "SMTP", label: "Custom SMTP" },
];

function CollapsibleDnsRecords({ records, sendingDomain, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (!records?.length) return null;

  return (
    <div className="rounded-lg border border-brand-secondary/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-brand-bg/60 px-4 py-3 text-left hover:bg-brand-bg/80 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-start gap-2 min-w-0">
          {open ? (
            <HiOutlineChevronDown className="h-4 w-4 shrink-0 text-brand-stone mt-0.5" />
          ) : (
            <HiOutlineChevronRight className="h-4 w-4 shrink-0 text-brand-stone mt-0.5" />
          )}
          <div className="min-w-0">
            <span className="text-sm font-medium text-brand-ink">
              DNS records for {sendingDomain}
            </span>
            <p className="mt-0.5 text-xs text-brand-stone">
              {records.length} record{records.length === 1 ? "" : "s"} · SPF, DKIM, DMARC, tracking
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs text-brand-steel">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="border-t border-brand-secondary/30 bg-white p-4 space-y-3">
          <p className="text-xs text-brand-stone leading-relaxed">
            Add these at your domain registrar (or DNS host). SPF, DKIM, and DMARC improve
            deliverability; the tracking CNAME is configured after you set a custom tracking domain
            in{" "}
            <a
              href="https://api.smartlead.ai/guides/best-practices"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-terracotta hover:underline"
            >
              Smartlead
            </a>
            .
          </p>
          <ul className="space-y-2.5">
            {records.map((r) => (
              <li
                key={r.id}
                className="rounded border border-brand-secondary/30 bg-brand-bg/50 p-2.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-brand-ink">
                    {r.type} · {r.host}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(r.value)}
                    className="inline-flex items-center gap-1 text-brand-terracotta hover:text-brand-ink"
                  >
                    <HiOutlineClipboardCopy className="h-3.5 w-3.5" />
                    Copy value
                  </button>
                </div>
                <p className="font-mono text-[11px] text-brand-stone break-all">{r.value}</p>
                {r.note ? <p className="text-brand-stone">{r.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MaildosoPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-brand-secondary/30 bg-brand-bg/50 p-4">
      <p className="text-sm text-brand-stone">
        Register and manage sending domains via Maildoso — purchase domains, configure DNS, and
        provision mailboxes from ClarWiz.
      </p>
      <p className="mt-2 text-xs text-brand-steel">Coming soon. Use Smartlead + your own inbox for now.</p>
    </div>
  );
}

export default function EmailIntegrationSection({
  integration,
  loading,
  onRefresh,
}) {
  const [mode, setMode] = useState("smartlead");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [password, setPassword] = useState("");
  const [providerType, setProviderType] = useState("GMAIL");
  const [smtpHost, setSmtpHost] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [customTrackingDomain, setCustomTrackingDomain] = useState("");
  const [trackingDraft, setTrackingDraft] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [previewDnsRecords, setPreviewDnsRecords] = useState(null);
  const [previewSendingDomain, setPreviewSendingDomain] = useState(null);

  const dnsRecords = integration?.dnsRecords ?? previewDnsRecords;
  const sendingDomain = integration?.sendingDomain ?? previewSendingDomain;

  useEffect(() => {
    if (integration?.customTrackingDomain) {
      setTrackingDraft(integration.customTrackingDomain);
    }
  }, [integration?.customTrackingDomain]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/email/smartlead/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName,
          fromEmail,
          password,
          providerType,
          smtpHost: providerType === "SMTP" ? smtpHost : undefined,
          imapHost: providerType === "SMTP" ? imapHost : undefined,
          customTrackingDomain: customTrackingDomain || undefined,
          warmupEnabled: true,
        }),
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          res.ok ? "Invalid server response" : `Connection failed (${res.status})`
        );
      }
      if (!res.ok) throw new Error(data.error || "Connection failed");

      setPassword("");
      if (data.warnings?.length) {
        data.warnings.forEach((w) => toast.warning(w));
      } else {
        toast.success(data.message || "Inbox connected via Smartlead");
      }
      if (data.integration?.customTrackingDomain) {
        setTrackingDraft(data.integration.customTrackingDomain);
      }
      onRefresh?.(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveTracking = async () => {
    setSavingTracking(true);
    try {
      const res = await fetch("/api/integrations/email/smartlead/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTrackingDomain: trackingDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save tracking domain");
      toast.success("Tracking domain updated");
      onRefresh?.(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingTracking(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/email", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      setPassword("");
      setPreviewDnsRecords(null);
      setPreviewSendingDomain(null);
      toast.success("Email integration removed");
      onRefresh?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const previewDns = async () => {
    const domain = fromEmail.split("@")[1];
    if (!domain) {
      toast.error("Enter a from email to preview DNS records");
      return;
    }
    try {
      const params = new URLSearchParams({ domain });
      if (customTrackingDomain) params.set("tracking", customTrackingDomain);
      const res = await fetch(`/api/integrations/email/dns?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewDnsRecords(data.dnsRecords);
      setPreviewSendingDomain(data.sendingDomain);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading email configuration…</p>;
  }

  const isConnected =
    integration?.mode === "smartlead_inbox" && integration?.status === "connected";
  const hasSmartlead =
    integration?.mode === "smartlead_inbox" && integration?.hasSmartleadAccount;

  const effectiveTrackingDraft =
    trackingDraft || integration?.customTrackingDomain || "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("smartlead")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "smartlead"
              ? "bg-brand-dark text-white"
              : "bg-brand-bg text-brand-stone hover:bg-brand-secondary/20"
          }`}
        >
          Connect inbox + Smartlead
        </button>
        <button
          type="button"
          onClick={() => setMode("maildoso")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "maildoso"
              ? "bg-brand-dark text-white"
              : "bg-brand-bg text-brand-stone hover:bg-brand-secondary/20"
          }`}
        >
          Register domains (Maildoso)
        </button>
      </div>

      {mode === "maildoso" ? <MaildosoPlaceholder /> : null}

      {mode === "smartlead" && (isConnected || hasSmartlead) ? (
        <>
          <section className="rounded-lg border border-brand-secondary/30 bg-brand-bg/50 p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
              Connected inbox
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <IntegrationStatusBadge status={integration.status} />
              <span className="text-sm text-brand-stone">
                {integration.fromName} · {integration.fromEmail}
              </span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-xs text-brand-steel">SMTP</dt>
                <dd
                  className={`mt-0.5 font-medium ${
                    integration.isSmtpSuccess ? "text-brand-ink" : "text-red-600"
                  }`}
                >
                  {integration.isSmtpSuccess ? "OK" : "Failed"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-steel">IMAP</dt>
                <dd
                  className={`mt-0.5 font-medium ${
                    integration.isImapSuccess ? "text-brand-ink" : "text-red-600"
                  }`}
                >
                  {integration.isImapSuccess ? "OK" : "Failed"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-steel">Warmup</dt>
                <dd className="mt-0.5 font-medium text-brand-ink">
                  {integration.warmupStatus || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-steel">Reputation</dt>
                <dd className="mt-0.5 font-medium text-brand-ink">
                  {integration.warmupReputation || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
              Tracking domain
            </h3>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-brand-stone mb-1">
                  Custom tracking domain
                </label>
                <input
                  type="text"
                  value={effectiveTrackingDraft}
                  onChange={(e) => setTrackingDraft(e.target.value)}
                  placeholder="track.yourdomain.com"
                  className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveTracking}
                disabled={savingTracking || !effectiveTrackingDraft.trim()}
                className="rounded-md border border-brand-secondary/30 px-3 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg disabled:opacity-50"
              >
                {savingTracking ? "Saving…" : "Save tracking"}
              </button>
            </div>
          </section>

          {dnsRecords?.length ? (
            <CollapsibleDnsRecords records={dnsRecords} sendingDomain={sendingDomain} />
          ) : null}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => onRefresh?.(true)}
              className="text-sm text-brand-terracotta hover:underline"
            >
              Refresh status
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect inbox"}
            </button>
          </div>
        </>
      ) : null}

      {mode === "smartlead" && !isConnected && !hasSmartlead ? (
        <>
          <p className="text-sm text-brand-stone leading-relaxed">
            Connect your sending inbox to Smartlead for warmup, outreach, and open/reply tracking.
            Uses your workspace Smartlead API key — credentials are sent only to Smartlead.
          </p>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-stone mb-1">From name</label>
                <input
                  required
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                  placeholder="Alex Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-stone mb-1">Provider</label>
                <select
                  value={providerType}
                  onChange={(e) => setProviderType(e.target.value)}
                  className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                >
                  {PROVIDER_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-brand-stone mb-1">From email</label>
                <input
                  type="email"
                  required
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                  placeholder="alex@yourcompany.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-brand-stone mb-1">
                  App password / SMTP password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-brand-steel">
                  Gmail: use an App Password with 2FA enabled. Never stored in ClarWiz.
                </p>
              </div>
              {providerType === "SMTP" ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-brand-stone mb-1">
                      SMTP host
                    </label>
                    <input
                      required
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-stone mb-1">
                      IMAP host
                    </label>
                    <input
                      required
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              ) : null}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-brand-stone mb-1">
                  Tracking domain (optional)
                </label>
                <input
                  value={customTrackingDomain}
                  onChange={(e) => setCustomTrackingDomain(e.target.value)}
                  placeholder="track.yourdomain.com"
                  className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={connecting}
                className="rounded-md bg-brand-dark px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Connect via Smartlead"}
              </button>
              <button
                type="button"
                onClick={previewDns}
                className="rounded-md border border-brand-secondary/30 px-3.5 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg"
              >
                Preview DNS records
              </button>
            </div>
          </form>

          {dnsRecords?.length && !integration?.hasSmartleadAccount ? (
            <CollapsibleDnsRecords
              records={dnsRecords}
              sendingDomain={sendingDomain}
              defaultOpen
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

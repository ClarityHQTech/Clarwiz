"use client";

import { useMemo, useState } from "react";
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineClipboardCopy,
} from "react-icons/hi";
import { toast } from "sonner";
import IntegrationStatusBadge from "@/components/settings/IntegrationStatusBadge";
import { ui } from "@/lib/brandUi";

const THIRD_PARTY_PROVIDERS = [
  { id: "interakt", label: "Interakt", available: true },
  { id: "aisensy", label: "AiSensy", available: false },
  { id: "wati", label: "Wati", available: false },
  { id: "gupshup", label: "Gupshup", available: false },
];

function TemplateList({ templates, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expandedId, setExpandedId] = useState(null);

  if (!templates?.length) {
    return (
      <p className="text-sm text-brand-stone">
        No templates loaded yet. Connect your account and refresh templates.
      </p>
    );
  }

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
              Approved templates
            </span>
            <p className="mt-0.5 text-xs text-brand-stone">
              {templates.length} template{templates.length === 1 ? "" : "s"} from your
              connected account
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs text-brand-steel">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <ul className="border-t border-brand-secondary/30 divide-y divide-brand-secondary/15 max-h-80 overflow-y-auto">
          {templates.map((t) => {
            const key = `${t.name}-${t.language}-${t.id}`;
            const isExpanded = expandedId === key;
            return (
              <li key={key} className="text-sm">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                  className="flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left hover:bg-brand-bg"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-brand-ink truncate">
                      {t.displayName || t.name}
                    </p>
                    <p className="text-xs text-brand-stone mt-0.5">
                      {t.name} · {t.language} · {t.status}
                      {t.category ? ` · ${t.category}` : ""}
                    </p>
                  </div>
                  {isExpanded ? (
                    <HiOutlineChevronDown className="h-4 w-4 shrink-0 text-brand-steel" />
                  ) : (
                    <HiOutlineChevronRight className="h-4 w-4 shrink-0 text-brand-steel" />
                  )}
                </button>
                {isExpanded ? (
                  <div className="px-4 pb-3 space-y-1.5 text-xs text-brand-stone bg-brand-bg/50">
                    {t.body ? (
                      <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                        {t.body}
                      </p>
                    ) : null}
                    {t.variableCount > 0 ? (
                      <p className="text-brand-stone">
                        {t.variableCount} body variable{t.variableCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                    <p className="text-brand-steel">ID: {t.id}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ComingSoonProviderCard({ label }) {
  return (
    <div className="rounded-lg border border-dashed border-brand-secondary/30 bg-brand-bg/50 px-3 py-2.5 text-sm text-brand-stone">
      {label} — available soon
    </div>
  );
}

export default function WhatsAppIntegrationSection({
  integration,
  loading,
  onRefresh,
}) {
  const [provider, setProvider] = useState("meta");
  const [thirdPartyId, setThirdPartyId] = useState("interakt");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshingTemplates, setRefreshingTemplates] = useState(false);

  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");

  const [interaktApiKey, setInteraktApiKey] = useState("");
  const [interaktWabaId, setInteraktWabaId] = useState("");
  const [interaktMetaToken, setInteraktMetaToken] = useState("");

  const interaktWebhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/integrations/whatsapp/interakt/webhook`;
  }, []);

  const metaWebhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/integrations/whatsapp/meta/webhook`;
  }, []);

  const copyWebhook = async (url, label) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} webhook URL copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleMetaConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/whatsapp/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, phoneNumberId, wabaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setAccessToken("");
      toast.success(data.message || "Meta WhatsApp connected");
      onRefresh?.(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleInteraktConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/whatsapp/interakt/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: interaktApiKey,
          wabaId: interaktWabaId || undefined,
          metaAccessToken: interaktMetaToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.integration) throw new Error(data.error || "Connection failed");
      setInteraktApiKey("");
      setInteraktMetaToken("");
      if (data.warning) toast.warning(data.warning);
      else toast.success(data.message || "Interakt connected");
      onRefresh?.(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/whatsapp", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      toast.success("WhatsApp integration removed");
      onRefresh?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefreshTemplates = async () => {
    setRefreshingTemplates(true);
    try {
      const res = await fetch("/api/integrations/whatsapp/templates?refresh=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to refresh templates");
      toast.success(`Loaded ${data.templates?.length ?? 0} templates`);
      onRefresh?.(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRefreshingTemplates(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading WhatsApp configuration…</p>;
  }

  const isConnected = integration?.status === "connected";

  if (isConnected) {
    return (
      <div className="space-y-5">
        <section className="rounded-lg border border-brand-secondary/30 bg-brand-bg/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <IntegrationStatusBadge status="connected" />
            <span className="text-sm text-brand-stone capitalize">
              {integration.mode === "meta" ? "Meta Cloud API" : "Interakt"}
            </span>
          </div>
          {integration.businessName || integration.businessPhone ? (
            <p className="text-sm text-brand-stone">
              {integration.businessName}
              {integration.businessName && integration.businessPhone ? " · " : ""}
              {integration.businessPhone}
            </p>
          ) : null}
          {integration.mode === "meta" ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-brand-steel">Phone number ID</dt>
                  <dd className="font-mono text-brand-stone mt-0.5">{integration.phoneNumberId}</dd>
                </div>
                <div>
                  <dt className="text-brand-steel">WABA ID</dt>
                  <dd className="font-mono text-brand-stone mt-0.5">{integration.wabaId}</dd>
                </div>
              </dl>
              <p className="text-xs text-brand-stone leading-relaxed">
                Incoming customer messages are written to the matching prospect&apos;s
                comm log (by phone number or reply context). Subscribe to{" "}
                <strong>messages</strong> in Meta Developer Console.
              </p>
            </>
          ) : (
            <p className="text-xs text-brand-stone">
              Send templates via Interakt&apos;s API. Delivery, read receipts, and
              incoming messages arrive via the webhook below.
            </p>
          )}
        </section>

        <TemplateList templates={integration.templates} />

        <section className="rounded-lg border border-brand-secondary/30 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
            {integration.mode === "meta" ? "Meta webhook URL" : "Interakt webhook URL"}
          </h3>
          <p className="text-xs text-brand-stone leading-relaxed">
            {integration.mode === "meta" ? (
              <>
                Add this callback URL in{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-terracotta hover:underline"
                >
                  Meta Developer Console
                </a>{" "}
                (WhatsApp → Configuration). Subscribe to <strong>messages</strong>{" "}
                field. Set verify token to <code className="text-[10px]">WHATSAPP_META_VERIFY_TOKEN</code> in .env.
              </>
            ) : (
              <>
                Use in{" "}
                <a
                  href="https://app.interakt.ai/settings/developer-setting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-terracotta hover:underline"
                >
                  Interakt Developer Settings
                </a>
                . Enable <strong>message_received</strong> for inbound replies.
              </>
            )}
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-[11px] bg-brand-bg border border-brand-secondary/30 rounded px-2 py-1.5 break-all">
              {integration.mode === "meta" ? metaWebhookUrl : interaktWebhookUrl}
            </code>
            <button
              type="button"
              onClick={() =>
                copyWebhook(
                  integration.mode === "meta" ? metaWebhookUrl : interaktWebhookUrl,
                  integration.mode === "meta" ? "Meta" : "Interakt"
                )
              }
              className="shrink-0 inline-flex items-center gap-1 text-xs text-brand-terracotta hover:text-brand-ink"
            >
              <HiOutlineClipboardCopy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRefreshTemplates}
            disabled={refreshingTemplates}
            className="text-sm text-brand-terracotta hover:underline disabled:opacity-50"
          >
            {refreshingTemplates ? "Refreshing templates…" : "Refresh templates"}
          </button>
          <button
            type="button"
            onClick={() => onRefresh?.(true)}
            className="text-sm text-brand-stone hover:underline"
          >
            Reload status
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setProvider("meta")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            provider === "meta"
              ? "bg-[#25D366] text-white"
              : "bg-brand-bg text-brand-stone hover:bg-brand-secondary/20"
          }`}
        >
          Meta (official)
        </button>
        <button
          type="button"
          onClick={() => setProvider("third_party")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            provider === "third_party"
              ? "bg-[#25D366] text-white"
              : "bg-brand-bg text-brand-stone hover:bg-brand-secondary/20"
          }`}
        >
          Third-party BSP
        </button>
      </div>

      {provider === "meta" ? (
        <>
          <p className="text-sm text-brand-stone leading-relaxed">
            Connect your{" "}
            <a
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-terracotta hover:underline"
            >
              Meta WhatsApp Cloud API
            </a>{" "}
            account. You need a permanent access token, phone number ID, and WABA ID to send
            templates and sync approved message templates.
          </p>
          <form onSubmit={handleMetaConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand-stone mb-1">
                Access token
              </label>
              <input
                type="password"
                required
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAA…"
                className={`${ui.inputSurface} font-mono`}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-stone mb-1">
                  Phone number ID
                </label>
                <input
                  required
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className={`${ui.inputSurface} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-stone mb-1">
                  WABA ID
                </label>
                <input
                  required
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className={`${ui.inputSurface} font-mono`}
                />
              </div>
            </div>
            <p className="text-xs text-brand-steel">
              Credentials are encrypted at rest. Incoming messages and read receipts require
              Meta webhooks (configure in Meta Developer Console).
            </p>
            <button
              type="submit"
              disabled={connecting}
              className="rounded-md bg-[#25D366] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1da851] disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect Meta WhatsApp"}
            </button>
          </form>
        </>
      ) : null}

      {provider === "third_party" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {THIRD_PARTY_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!p.available}
                onClick={() => p.available && setThirdPartyId(p.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  thirdPartyId === p.id
                    ? "bg-brand-dark text-white"
                    : p.available
                      ? "bg-brand-bg text-brand-stone hover:bg-brand-secondary/20"
                      : "bg-brand-bg text-brand-steel cursor-not-allowed"
                }`}
              >
                {p.label}
                {!p.available ? " (soon)" : ""}
              </button>
            ))}
          </div>

          {thirdPartyId === "interakt" ? (
            <>
              <p className="text-sm text-brand-stone leading-relaxed">
                Connect via{" "}
                <a
                  href="https://www.interakt.shop/resource-center/how-to-send-whatsapp-templates-using-apis-webhooks/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-terracotta hover:underline"
                >
                  Interakt&apos;s Template API
                </a>
                . Your API key is stored encrypted. Optionally add Meta WABA ID + token to
                sync templates from your WhatsApp Business Account.
              </p>
              <form onSubmit={handleInteraktConnect} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-brand-stone mb-1">
                    Interakt API key
                  </label>
                  <input
                    type="password"
                    required
                    value={interaktApiKey}
                    onChange={(e) => setInteraktApiKey(e.target.value)}
                    className={ui.inputSurface}
                  />
                  <p className="mt-1 text-xs text-brand-steel">
                    From{" "}
                    <a
                      href="https://app.interakt.ai/settings/developer-setting"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-terracotta hover:underline"
                    >
                      Interakt Developer Settings
                    </a>
                    . Sent as Authorization: Basic &lt;key&gt;.
                  </p>
                </div>
                <div className="rounded-lg border border-dashed border-brand-secondary/30 p-3 space-y-3">
                  <p className="text-xs font-medium text-brand-stone">
                    Optional — sync templates via Meta Graph API
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-brand-stone mb-1">
                        WABA ID
                      </label>
                      <input
                        value={interaktWabaId}
                        onChange={(e) => setInteraktWabaId(e.target.value)}
                        className={`${ui.inputSurface} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-brand-stone mb-1">
                        Meta access token
                      </label>
                      <input
                        type="password"
                        value={interaktMetaToken}
                        onChange={(e) => setInteraktMetaToken(e.target.value)}
                        className={`${ui.inputSurface} font-mono`}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={connecting}
                  className="rounded-md bg-brand-dark px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
                >
                  {connecting ? "Connecting…" : "Connect Interakt"}
                </button>
              </form>
            </>
          ) : (
            <ComingSoonProviderCard
              label={THIRD_PARTY_PROVIDERS.find((p) => p.id === thirdPartyId)?.label}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

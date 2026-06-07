"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import IntegrationStatusBadge from "@/components/settings/IntegrationStatusBadge";
import { ui } from "@/lib/brandUi";

function formatWhen(iso) {
  if (!iso) return "No events yet";
  return new Date(iso).toLocaleString();
}

function getWebhookStatusKey(wh) {
  return wh.displayStatus ?? wh.status ?? "pending";
}

function getStatusDescription(wh, statusKey) {
  if (statusKey === "connected") {
    if (wh.lastEventAt) {
      return `Receiving events · Last event ${formatWhen(wh.lastEventAt)}`;
    }
    if (wh.showUserSetup === false) return "Active";
    if (wh.providerWebhookId) return "Registered";
    if (wh.verifiedAt) {
      return `Verified in Meta · Waiting for first event (${formatWhen(wh.verifiedAt)})`;
    }
    return "Configured — waiting for first event";
  }
  if (statusKey === "error") {
    return wh.showUserSetup
      ? "Setup failed — retry or complete manual configuration"
      : "Setup failed — use Connect webhook to retry";
  }
  if (wh.showUserSetup === false) {
    if (wh.provider === "smartlead") {
      if (statusKey === "pending") return "Not connected — use Connect webhook";
      return "Tracks sent, opens, link clicks, and replies";
    }
    return "Set up automatically when you connect this channel";
  }
  if (wh.manualSetupRequired) {
    if (wh.hasVerifyToken && wh.provider === "whatsapp_meta") {
      return "Add callback URL in Meta — click Verify there to refresh status";
    }
    return "Manual callback URL setup required";
  }
  return "Pending registration";
}

export default function WebhooksStatusSection({ refreshSignal = 0 }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registeringProvider, setRegisteringProvider] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/webhooks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load webhooks");
      setWebhooks(data.webhooks ?? []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const copyText = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const registerWebhook = async (provider, { force = false } = {}) => {
    setRegisteringProvider(provider);
    try {
      const res = await fetch("/api/settings/webhooks/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Webhook registration failed");

      setWebhooks(data.webhooks ?? []);

      const result = data.result;
      if (result?.ok) {
        if (result.pending || result.manualSetupRequired) {
          toast.info(
            result.message ||
              (result.manualSetupRequired
                ? "Complete webhook setup in the channel provider console."
                : "Webhook setup in progress.")
          );
        } else {
          toast.success(result.message || "Webhook connected");
        }
      } else {
        toast.error(result?.error || "Could not register webhook");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRegisteringProvider(null);
    }
  };

  const registerAll = async () => {
    setRegisteringProvider("__all__");
    try {
      const res = await fetch("/api/settings/webhooks/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Webhook registration failed");

      setWebhooks(data.webhooks ?? []);

      const results = data.results ?? [];
      const failed = results.filter((r) => !r.ok);
      const pending = results.filter((r) => r.ok && (r.pending || r.manualSetupRequired));

      if (failed.length === 0 && pending.length === 0) {
        toast.success("All webhooks registered");
      } else if (failed.length === 0) {
        toast.info("Some channels need manual webhook setup — see WhatsApp below.");
      } else {
        toast.warning(
          `${failed.length} webhook${failed.length === 1 ? "" : "s"} need attention — see details below.`
        );
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRegisteringProvider(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading webhook status…</p>;
  }

  if (!webhooks.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-brand-stone">
          Connect email, LinkedIn, WhatsApp, or Calendly Standard+ to set up webhooks for
          opens, replies, and booking events.
        </p>
        <button
          type="button"
          onClick={load}
          className={`text-sm ${ui.btnSecondarySurface}`}
        >
          Check status
        </button>
      </div>
    );
  }

  const needsAction = webhooks.filter((wh) => {
    const status = getWebhookStatusKey(wh);
    if (status === "error") return true;
    if (status === "pending" && wh.autoRegisterSupported) return true;
    if (status === "pending" && wh.showUserSetup) return true;
    return false;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-brand-stone max-w-2xl">
          Webhooks deliver opens, replies, connection accepts, and message events into comm
          logs for autopilot campaigns. They are set up automatically when you connect a channel,
          or via the steps below when manual configuration is required.
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={`text-xs ${ui.btnSecondarySurface}`}
          >
            Check status
          </button>
          {needsAction.length > 0 ? (
            <button
              type="button"
              onClick={registerAll}
              disabled={registeringProvider === "__all__"}
              className="rounded-md bg-brand-dark px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-ink disabled:opacity-50"
            >
              {registeringProvider === "__all__" ? "Connecting…" : "Connect all webhooks"}
            </button>
          ) : null}
        </div>
      </div>

      <ul className="space-y-3">
        {webhooks.map((wh) => {
          const statusKey = getWebhookStatusKey(wh);
          const showConnect =
            (statusKey === "pending" || statusKey === "error") &&
            wh.channelConnected &&
            (wh.autoRegisterSupported || statusKey === "error");
          const isRegistering = registeringProvider === wh.provider;
          const showUrlActions = wh.showWebhookUrl !== false && wh.webhookUrl;

          return (
            <li key={wh.id} className={`${ui.cardSurface} p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-brand-ink">{wh.label}</p>
                    <IntegrationStatusBadge status={statusKey} />
                  </div>
                  <p className="text-xs text-brand-stone mt-1">
                    {getStatusDescription(wh, statusKey)}
                  </p>
                  {wh.showUserSetup === false && wh.setupInstructions ? (
                    <p className="text-xs text-brand-steel mt-1">{wh.setupInstructions}</p>
                  ) : null}
                  {wh.lastError ? (
                    <p className="text-xs text-red-600 mt-1">{wh.lastError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                  {showConnect ? (
                    <button
                      type="button"
                      onClick={() =>
                        registerWebhook(wh.provider, { force: statusKey === "error" })
                      }
                      disabled={isRegistering}
                      className="rounded-md bg-brand-dark px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-ink disabled:opacity-50"
                    >
                      {isRegistering
                        ? "Connecting…"
                        : wh.autoRegisterSupported
                          ? "Connect webhook"
                          : "Retry setup"}
                    </button>
                  ) : null}
                  {showUrlActions ? (
                    <button
                      type="button"
                      onClick={() => copyText(wh.webhookUrl, "Callback URL")}
                      className={`${ui.btnSecondarySurface} text-xs`}
                    >
                      Copy URL
                    </button>
                  ) : null}
                </div>
              </div>

              {wh.showUserSetup !== false && wh.setupInstructions ? (
                <div className="rounded-md border border-brand-secondary/20 bg-brand-bg/50 px-3 py-2.5 space-y-2">
                  <p className="text-xs text-brand-stone leading-relaxed">
                    {wh.setupInstructions}
                  </p>
                  {showUrlActions ? (
                    <code className="block text-[11px] font-mono text-brand-ink break-all bg-brand-surface border border-brand-secondary/20 rounded px-2 py-1.5">
                      {wh.webhookUrl}
                    </code>
                  ) : null}
                  {wh.hasVerifyToken &&
                  wh.provider === "whatsapp_meta" ? (
                    <p className="text-xs text-brand-steel">
                      Verify token saved (encrypted). Use the same value in Meta Developer
                      Console.
                    </p>
                  ) : null}
                  {wh.docsUrl ? (
                    <a
                      href={wh.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-brand-terracotta hover:underline"
                    >
                      Provider documentation →
                    </a>
                  ) : null}
                </div>
              ) : null}

              {wh.canRead?.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-brand-ink mb-1">Events</p>
                  <ul className="flex flex-wrap gap-1">
                    {wh.canRead.map((ev) => (
                      <li
                        key={ev}
                        className="text-xs rounded-md bg-brand-sand/50 px-2 py-0.5 text-brand-stone"
                      >
                        {ev.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

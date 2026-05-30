"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import IntegrationStatusBadge from "@/components/settings/IntegrationStatusBadge";

const MODES = {
  BOOKING_LINK: "booking_link",
  WEBHOOKS: "webhooks",
};

const CONNECTION_OPTIONS = [
  {
    mode: MODES.BOOKING_LINK,
    title: "Calendly Free",
    subtitle: "Tracked booking link & replies",
    benefits: [
      "Qualify when a prospect clicks your tracked booking link (stage 2+ outreach)",
      "Qualify on positive email reply after they engaged",
      "Paste your Calendly URL on each campaign — no webhook required",
    ],
    limitations: [
      "Does not auto-qualify when someone completes a booking in Calendly",
      "Requires a separate Clarwiz OAuth app (users:read only)",
    ],
    calendlyPlan: "Works with Calendly Free",
    connectLabel: "Connect (Free plan)",
  },
  {
    mode: MODES.WEBHOOKS,
    title: "Calendly Standard+",
    subtitle: "Auto-qualify on book",
    benefits: [
      "Everything in Free, plus instant qualify on invitee.created (meeting booked)",
      "Logs invitee.canceled and rescheduled signals on matching prospects",
      "Best when you want qualification only after a real calendar booking",
    ],
    limitations: [
      "Your connected Calendly account must be on Standard or above",
      "Uses Clarwiz Standard OAuth app (users:read, scheduled_events:read, webhooks:write)",
      "Webhook callback must be public HTTPS (ngrok or deployed URL)",
    ],
    calendlyPlan: "Requires Calendly Standard, Teams, or Enterprise",
    connectLabel: "Connect (Standard+)",
    recommended: true,
  },
];

function getCalendlyDisplayStatus(integration) {
  if (!integration) return "not_configured";
  if (integration.status === "connected") return "connected";
  if (integration.status === "error") return "failed";
  return "pending";
}

function modeLabel(mode) {
  return mode === MODES.WEBHOOKS ? "Standard+ (webhooks)" : "Free (booking link)";
}

export default function CalendlyIntegrationSection({ integration, onRefresh }) {
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendly = params.get("calendly");
    if (!calendly) return;

    if (calendly === "connected") {
      toast.success(
        "Calendly Standard+ connected — auto-qualify on book is active (invitee.created)"
      );
      onRefresh?.();
    } else if (calendly === "connected_booking_link") {
      toast.success(
        "Calendly Free connected — use tracked booking links on campaigns for qualification"
      );
      onRefresh?.();
    } else if (calendly === "error") {
      const reason = params.get("reason") || "Connection failed";
      toast.error(`Calendly: ${reason}`);
    }

    params.delete("calendly");
    params.delete("reason");
    const qs = params.toString();
    const path = window.location.pathname + (qs ? `?${qs}` : "");
    window.history.replaceState({}, "", path);
  }, [onRefresh]);

  const connect = (mode) => {
    window.location.href = `/api/integrations/calendly/oauth/start?mode=${encodeURIComponent(mode)}`;
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/calendly", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      toast.success("Calendly disconnected");
      onRefresh?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/calendly`
      : "/api/webhooks/calendly";

  const status = getCalendlyDisplayStatus(integration);
  const connected = status === "connected";
  const activeMode = integration?.connectionMode;
  const webhooksActive = integration?.webhooksActive;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <IntegrationStatusBadge status={status} />
        {connected && activeMode && (
          <span className="text-xs text-brand-stone bg-brand-bg px-2 py-0.5 rounded-full">
            Mode: {modeLabel(activeMode)}
          </span>
        )}
        {webhooksActive && (
          <span className="text-xs text-brand-ink bg-brand-sage/20 px-2 py-0.5 rounded-full">
            Webhooks: invitee.created, invitee.canceled
          </span>
        )}
      </div>

      {connected && integration?.ownerEmail && (
        <p className="text-sm text-brand-stone">
          Connected as <span className="font-medium">{integration.ownerEmail}</span>
        </p>
      )}

      <p className="text-sm text-brand-stone leading-relaxed">
        Choose how Clarwiz qualifies prospects from Calendly. Your Calendly{" "}
        <span className="font-medium text-brand-stone">account plan</span> must match the option
        you connect — Free accounts cannot register API webhooks (Calendly returns an upgrade
        error for <code className="text-xs bg-brand-bg px-1 rounded">webhooks:write</code>).
        You can disconnect and switch after upgrading.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CONNECTION_OPTIONS.map((option) => {
          const isActive = connected && activeMode === option.mode;
          return (
            <div
              key={option.mode}
              className={`rounded-xl border p-4 flex flex-col ${
                isActive
                  ? "border-brand-sage/40 bg-brand-sage/10 ring-1 ring-brand-sage/30"
                  : "border-brand-secondary/30 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-brand-ink">{option.title}</h3>
                  <p className="text-xs text-brand-stone mt-0.5">{option.subtitle}</p>
                </div>
                {option.recommended && !isActive && (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-brand-terracotta bg-brand-sage/20 px-1.5 py-0.5 rounded">
                    Recommended
                  </span>
                )}
                {isActive && (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-brand-ink bg-brand-sage/25 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>

              <p className="text-xs text-brand-stone mt-2">{option.calendlyPlan}</p>

              <ul className="mt-3 space-y-1.5 text-xs text-brand-stone flex-1">
                {option.benefits.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span className="text-brand-sage shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {option.limitations?.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-brand-steel">
                  {option.limitations.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <span className="shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {!connected && (
                <button
                  type="button"
                  onClick={() => connect(option.mode)}
                  className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium ${
                    option.mode === MODES.WEBHOOKS
                      ? "bg-brand-dark text-white hover:bg-brand-ink"
                      : "border border-brand-secondary/40 bg-white text-brand-stone hover:bg-brand-bg"
                  }`}
                >
                  {option.connectLabel}
                </button>
              )}

              {connected && !isActive && (
                <button
                  type="button"
                  onClick={() => connect(option.mode)}
                  className="mt-4 w-full rounded-lg border border-brand-secondary/40 bg-white px-3 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg"
                >
                  Switch to {option.title}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activeMode === MODES.WEBHOOKS && (
        <div className="rounded-lg border border-brand-secondary/30 bg-brand-bg/60 px-3 py-2.5">
          <p className="text-xs font-medium text-brand-stone">
            Webhook endpoint (registered on Standard+ connect)
          </p>
          <p className="text-xs text-brand-stone mt-1 break-all font-mono">{webhookUrl}</p>
          <p className="text-xs text-brand-steel mt-1">
            For local dev, set{" "}
            <code className="bg-brand-bg px-0.5">CALENDLY_WEBHOOK_URL</code> to a public HTTPS
            URL (e.g. ngrok). Calendly rejects localhost.
          </p>
          <p className="text-xs text-brand-steel mt-1">
            Set <code className="bg-brand-bg px-0.5">CALENDLY_WEBHOOK_SIGNING_KEY</code> from the
            subscription signing key to verify signatures.
          </p>
        </div>
      )}

      {connected && activeMode === MODES.BOOKING_LINK && (
        <p className="text-xs text-brand-stone rounded-lg border border-brand-terracotta/40 bg-brand-terracotta/15 px-3 py-2">
          Add your Calendly scheduling URL on each campaign. Outreach stage 2+ and reply
          follow-ups append a tracked link that qualifies on click — not when the invitee
          finishes booking in Calendly.
        </p>
      )}

      {connected && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={disconnecting}
            onClick={disconnect}
            className="inline-flex items-center rounded-lg border border-brand-secondary/40 bg-white px-4 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
          <button
            type="button"
            onClick={() => connect(activeMode || MODES.WEBHOOKS)}
            className="inline-flex items-center rounded-lg border border-brand-secondary/40 bg-white px-4 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg"
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import IntegrationStatusBadge from "@/components/settings/IntegrationStatusBadge";
function getCalendlyDisplayStatus(integration) {
  if (!integration) return "not_configured";
  if (integration.status === "connected") return "connected";
  if (integration.status === "error") return "failed";
  return "pending";
}

export default function CalendlyIntegrationSection({ integration, onRefresh }) {
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendly = params.get("calendly");
    if (!calendly) return;

    if (calendly === "connected") {
      toast.success("Calendly connected — webhooks active for invitee.created & invitee.canceled");
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

  const connect = () => {
    window.location.href = "/api/integrations/calendly/oauth/start";
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <IntegrationStatusBadge status={status} />
        {integration?.webhooksActive && (
          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            Webhooks: invitee.created, invitee.canceled
          </span>
        )}
      </div>

      {connected && integration?.ownerEmail && (
        <p className="text-sm text-gray-600">
          Connected as <span className="font-medium">{integration.ownerEmail}</span>
        </p>
      )}

      <p className="text-sm text-gray-500 leading-relaxed">
        Connect Calendly to automatically qualify prospects when they book a meeting.
        ClarWiz subscribes to{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">invitee.created</code> and{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">invitee.canceled</code> via the
        Calendly API when you connect.
      </p>

      <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5">
        <p className="text-xs font-medium text-gray-700">Webhook endpoint (registered on connect)</p>
        <p className="text-xs text-gray-500 mt-1 break-all font-mono">{webhookUrl}</p>
        <p className="text-xs text-gray-400 mt-1">
          For local dev, set{" "}
          <code className="bg-gray-100 px-0.5">CALENDLY_WEBHOOK_URL</code> to a public HTTPS URL
          (e.g. ngrok). Calendly rejects localhost.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Set <code className="bg-gray-100 px-0.5">CALENDLY_WEBHOOK_SIGNING_KEY</code> from the
          subscription signing key to verify signatures.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <button
            type="button"
            onClick={connect}
            className="inline-flex items-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Connect Calendly
          </button>
        ) : (
          <button
            type="button"
            disabled={disconnecting}
            onClick={disconnect}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        )}
        {connected && (
          <button
            type="button"
            onClick={connect}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
}

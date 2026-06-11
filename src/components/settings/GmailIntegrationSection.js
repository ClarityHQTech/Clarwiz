"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import IntegrationStatusBadge, {
  getGmailDisplayStatus,
} from "@/components/settings/IntegrationStatusBadge";
import { ui } from "@/lib/brandUi";
import { GMAIL_SEND_SCOPE } from "@/lib/gmail/gmailScopes";

/**
 * Per-user Gmail OAuth for NBA / AE Assist email send.
 * @param {{ gmail: object, loading?: boolean, onRefresh?: () => void, returnTo?: 'integrations'|'assist_settings' }} props
 */
export default function GmailIntegrationSection({
  gmail,
  loading = false,
  onRefresh,
  returnTo = "integrations",
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gmail");
    if (!status) return;
    if (status === "connected") {
      toast.success("Gmail connected — you can send emails from the platform");
      onRefresh?.();
    } else if (status === "denied") toast.error("Gmail connection was denied");
    else if (status === "badstate") toast.error("Gmail connection expired — try again");
    else if (status === "error") toast.error("Gmail connection failed — try again");
    const url = new URL(window.location.href);
    url.searchParams.delete("gmail");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [onRefresh]);

  const connectGmail = () => {
    const q = returnTo === "assist_settings" ? "" : `?returnTo=${returnTo}`;
    window.location.href = `/api/assist/gmail/oauth/start${q}`;
  };

  const disconnectGmail = async () => {
    try {
      const res = await fetch("/api/assist/gmail", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not disconnect Gmail");
        return;
      }
      toast.success("Gmail disconnected");
      onRefresh?.();
    } catch {
      toast.error("Could not disconnect Gmail");
    }
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading Gmail configuration…</p>;
  }

  const status = getGmailDisplayStatus(gmail);
  const connected = gmail?.connected;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IntegrationStatusBadge status={status} />
      </div>

      <p className="text-sm text-brand-stone">
        Connect your Gmail to send NBA and AE Assist emails directly from Clarwiz. The same
        message is logged on the HubSpot deal timeline. Each user connects their own mailbox.
      </p>

      <div className="rounded-lg border border-brand-secondary/20 bg-brand-bg/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-steel mb-1">
          OAuth scope
        </p>
        <p className="text-xs font-mono text-brand-ink break-all">{GMAIL_SEND_SCOPE}</p>
      </div>

      {connected ? (
        <div className="space-y-3">
          <p className="text-sm text-brand-stone">
            Sending as <span className="font-medium text-brand-ink">{gmail.email}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ui.btnSecondarySurface} onClick={connectGmail}>
              Reconnect Gmail
            </button>
            <button type="button" className={ui.btnGhost} onClick={disconnectGmail}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={ui.btnPrimary} onClick={connectGmail}>
          Connect Gmail
        </button>
      )}
    </div>
  );
}

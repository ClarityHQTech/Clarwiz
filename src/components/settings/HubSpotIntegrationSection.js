"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import IntegrationStatusBadge, {
  getHubSpotDisplayStatus,
} from "@/components/settings/IntegrationStatusBadge";
import { ui } from "@/lib/brandUi";

export default function HubSpotIntegrationSection({ integration, loading, onRefresh }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("hubspot");
    if (!status) return;
    if (status === "connected") {
      toast.success("HubSpot connected via OAuth");
      onRefresh?.();
    } else if (status === "denied") toast.error("HubSpot connection was denied");
    else if (status === "badstate") toast.error("HubSpot connection expired — please try again");
    else if (status === "error") toast.error("HubSpot connection failed — please try again");
    window.history.replaceState({}, "", window.location.pathname);
  }, [onRefresh]);

  const connectHubspot = () => {
    window.location.href = "/api/assist/hubspot/oauth/start";
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading HubSpot configuration…</p>;
  }

  const status = getHubSpotDisplayStatus(integration);
  const connected = integration?.configured;
  const scopes = integration?.hubspotScopes ?? [];
  const recordingScopes = integration?.recordingScopes ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IntegrationStatusBadge status={status} />
      </div>

      {connected ? (
        <div className="space-y-3">
          <p className="text-sm text-brand-stone">
            Connected via OAuth · Portal {integration.hubspotPortalId || "—"}
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-steel mb-2">
              Granted scopes ({scopes.length})
            </p>
            {scopes.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {scopes.map((scope) => (
                  <li
                    key={scope}
                    className="rounded-md bg-brand-bg px-2 py-1 text-xs font-mono text-brand-ink ring-1 ring-inset ring-brand-steel/25"
                  >
                    {scope}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-stone">No scopes recorded — try reconnecting HubSpot.</p>
            )}
          </div>
          <div className="rounded-lg border border-brand-secondary/20 bg-brand-bg/50 p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
              Call & meeting recordings
            </p>
            <p className="text-sm text-brand-stone">
              {recordingScopes.hasTranscriptsRead
                ? "Transcript scope granted — Clarwiz can fetch call transcripts on sync (third-party / Recordings API)."
                : "Transcript scope not granted — reconnect HubSpot and add crm.extensions_calling_transcripts.read to optional scopes."}
            </p>
            <p className="text-xs text-brand-steel">
              Native Zoom / Google Meet transcripts visible in HubSpot may still be UI-only; meeting notes sync as a fallback.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-brand-stone">
          Install the Clarwiz app into your HubSpot portal to grant access — no token to paste.
          AE Assist uses this connection to read deals, companies, and contacts.
        </p>
      )}

      <button type="button" className={ui.btnPrimary} onClick={connectHubspot}>
        {connected ? "Reconnect HubSpot" : "Connect HubSpot"}
      </button>
    </div>
  );
}

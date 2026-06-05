"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

const PROVIDER_LABELS = {
  smartlead: "Email (Smartlead)",
  linkup: "LinkedIn (LinkupAPI)",
  whatsapp_meta: "WhatsApp (Meta)",
  whatsapp_interakt: "WhatsApp (Interakt)",
};

function formatWhen(iso) {
  if (!iso) return "No events yet";
  return new Date(iso).toLocaleString();
}

export default function WebhooksStatusSection() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, [load]);

  const copyUrl = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied");
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading webhook status…</p>;
  }

  if (!webhooks.length) {
    return (
      <p className="text-sm text-brand-stone">
        Connect email, LinkedIn, or WhatsApp integrations to register webhooks.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-stone">
        Webhooks deliver opens, replies, connection accepts, and message events into
        comm logs for autopilot campaigns.
      </p>
      <ul className="space-y-3">
        {webhooks.map((wh) => (
          <li key={wh.id} className={`${ui.cardSurface} p-4 space-y-2`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  {PROVIDER_LABELS[wh.provider] ?? wh.provider}
                </p>
                <p className="text-xs text-brand-stone capitalize">
                  Status: {wh.status}
                  {wh.lastEventAt && ` · Last event ${formatWhen(wh.lastEventAt)}`}
                </p>
                {wh.lastError && (
                  <p className="text-xs text-red-600 mt-1">{wh.lastError}</p>
                )}
              </div>
              {wh.webhookUrl && (
                <button
                  type="button"
                  onClick={() => copyUrl(wh.webhookUrl)}
                  className={`shrink-0 ${ui.btnSecondarySurface} text-xs`}
                >
                  Copy URL
                </button>
              )}
            </div>
            {wh.canRead?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-brand-ink mb-1">Reads</p>
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
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

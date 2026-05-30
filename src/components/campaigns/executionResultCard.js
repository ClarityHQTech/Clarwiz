"use client";

import { CHANNEL_LABELS } from "@/lib/campaignConstants";

export function ResultCard({ result }) {
  if (result.skipped) {
    return (
      <div className="rounded-lg border border-brand-terracotta/40 bg-brand-terracotta/15 px-3 py-2.5 text-sm">
        <p className="font-medium text-brand-ink">{result.prospectName}</p>
        <p className="text-brand-ink text-xs mt-1">
          Skipped: {result.reason || result.error || "No action"}
        </p>
        {result.modelUsed && (
          <p className="text-xs text-brand-stone mt-0.5">
            Model: {result.modelUsed}
            {result.providerUsage?.total_tokens != null &&
              ` · ${result.providerUsage.total_tokens} tokens`}
            {result.providerCost?.total_cost_usd != null &&
              ` · $${result.providerCost.total_cost_usd}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-secondary/30 bg-white px-3 py-2.5 text-sm space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-brand-ink">{result.prospectName}</p>
        <span className="shrink-0 text-xs rounded-md bg-brand-sage/15 text-brand-ink px-2 py-0.5">
          {CHANNEL_LABELS[result.channel] ?? result.channel} · S{result.stage}
        </span>
      </div>
      {result.subject && (
        <p className="text-xs text-brand-stone">
          <span className="font-medium">Subject:</span> {result.subject}
        </p>
      )}
      <p className="text-xs text-brand-stone whitespace-pre-wrap border-l-2 border-brand-sage/30 pl-2">
        {result.message}
      </p>
      <p className="text-xs text-brand-stone">
        CTA: {result.ctaType} · Log: {result.commLogId?.slice(0, 8)}…
      </p>
      <p className="text-xs text-brand-stone italic">{result.decisionReason}</p>
      {(result.channel === "email" ||
        result.channel === "linkedin" ||
        result.channel === "whatsapp") && (
        <p className="text-xs text-brand-stone">
          {result.channel === "email" ? "Smartlead" : "Delivery"}:{" "}
          {result.channelSendError || result.smartleadError
            ? `send failed — ${result.channelSendError || result.smartleadError}`
            : result.channelQueued ||
                result.smartleadQueued ||
                result.status === "queued"
              ? `queued — ${result.deliveryMessage || "queued"}`
              : result.channelSent ||
                  result.smartleadSent ||
                  result.status === "sent"
                ? `delivered (${result.status ?? "sent"})`
                : result.channelSendSkipped
                  ? "planned only (connect channel in Settings)"
                  : result.deliveryProvider
                    ? result.status ?? "logged"
                    : "planned only (connect channel in Settings)"}
        </p>
      )}
    </div>
  );
}

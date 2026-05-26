"use client";

import { CHANNEL_LABELS } from "@/lib/campaignConstants";

export function ResultCard({ result }) {
  if (result.skipped) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm">
        <p className="font-medium text-gray-900">{result.prospectName}</p>
        <p className="text-amber-800 text-xs mt-1">
          Skipped: {result.reason || result.error || "No action"}
        </p>
        {result.modelUsed && (
          <p className="text-xs text-gray-500 mt-0.5">
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
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-900">{result.prospectName}</p>
        <span className="shrink-0 text-xs rounded-md bg-sky-50 text-sky-800 px-2 py-0.5">
          {CHANNEL_LABELS[result.channel] ?? result.channel} · S{result.stage}
        </span>
      </div>
      {result.subject && (
        <p className="text-xs text-gray-600">
          <span className="font-medium">Subject:</span> {result.subject}
        </p>
      )}
      <p className="text-xs text-gray-700 whitespace-pre-wrap border-l-2 border-sky-200 pl-2">
        {result.message}
      </p>
      <p className="text-xs text-gray-500">
        CTA: {result.ctaType} · Log: {result.commLogId?.slice(0, 8)}…
      </p>
      <p className="text-xs text-gray-500 italic">{result.decisionReason}</p>
      {(result.channel === "email" ||
        result.channel === "linkedin" ||
        result.channel === "whatsapp") && (
        <p className="text-xs text-gray-500">
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

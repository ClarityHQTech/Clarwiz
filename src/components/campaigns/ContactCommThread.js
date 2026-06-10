"use client";

import { CAMPAIGN_CHANNELS, CHANNEL_LABELS } from "@/lib/campaignConstants";
import { DEFAULT_ENABLED_CHANNELS } from "@/lib/campaignChannels";
import ContactCopilotComposer from "@/components/campaigns/ContactCopilotComposer";
import { isProspectReply } from "@/lib/commLogEngagement";
import { useEffect, useMemo, useState } from "react";

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventTimestamp(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Flatten comm logs into ordered outbound/inbound chat events. */
function buildThreadEvents(logs) {
  const events = [];

  for (const log of logs) {
    const hasOutbound =
      log.status !== "skipped" && Boolean(log.message?.trim());
    const hasInbound = Boolean(log.responseContent?.trim());

    if (hasOutbound) {
      events.push({
        id: `${log.id}-outbound`,
        kind: "outbound",
        at: log.sentAt,
        log,
      });
    }

    if (hasInbound && isProspectReply(log)) {
      events.push({
        id: `${log.id}-inbound`,
        kind: "inbound",
        at: log.responseAt ?? log.sentAt,
        log,
      });
    } else if (hasInbound && !hasOutbound) {
      events.push({
        id: `${log.id}-inbound`,
        kind: "inbound",
        at: log.responseAt ?? log.sentAt,
        log,
      });
    }
  }

  return events.sort(
    (a, b) => eventTimestamp(a.at) - eventTimestamp(b.at)
  );
}

function OutboundBubble({ log }) {
  const hasEngagement = Boolean(
    log.openedAt || (isProspectReply(log) && log.responseAt)
  );

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-brand-sage/15 border border-brand-sage/25 px-3.5 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-steel">
            You
          </span>
          {log.stage != null && (
            <span className="text-[11px] text-brand-steel">· Stage {log.stage}</span>
          )}
          <span className="text-[11px] text-brand-steel capitalize ml-auto">
            {formatDateTime(log.sentAt)}
          </span>
        </div>
        {log.subject && (
          <p className="text-xs font-medium text-brand-ink mb-1.5">{log.subject}</p>
        )}
        <p className="text-sm leading-relaxed text-brand-ink whitespace-pre-wrap break-words">
          {log.message}
        </p>
        {hasEngagement && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-brand-steel mt-2 pt-2 border-t border-brand-sage/20">
            {log.openedAt && <span>Opened {formatDateTime(log.openedAt)}</span>}
            {isProspectReply(log) && log.responseAt && (
              <span>Replied {formatDateTime(log.responseAt)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InboundBubble({ log }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-white border border-brand-secondary/35 px-3.5 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-steel">
            Contact
          </span>
          <span className="text-[11px] text-brand-steel ml-auto">
            {formatDateTime(log.responseAt ?? log.sentAt)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-brand-ink whitespace-pre-wrap break-words">
          {log.responseContent}
        </p>
      </div>
    </div>
  );
}

function ChannelThread({ logs }) {
  const events = useMemo(() => buildThreadEvents(logs), [logs]);

  if (!events.length) {
    return (
      <div className="flex items-center justify-center min-h-[280px] rounded-lg border border-dashed border-brand-secondary/35 bg-brand-bg/40">
        <p className="text-sm text-brand-stone px-4 text-center">
          No messages on this channel yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-secondary/25 bg-brand-bg/30 min-h-[280px] max-h-[min(52vh,480px)] overflow-y-auto px-3 py-4">
      <div className="space-y-4">
        {events.map((event) =>
          event.kind === "outbound" ? (
            <OutboundBubble key={event.id} log={event.log} />
          ) : (
            <InboundBubble key={event.id} log={event.log} />
          )
        )}
      </div>
    </div>
  );
}

export default function ContactCommThread({
  communications,
  copilotMode = false,
  campaign,
  prospect,
  campaignId,
  campaignContactId,
  templates = [],
  enabledChannels = DEFAULT_ENABLED_CHANNELS,
  onSent,
}) {
  const byChannel = useMemo(() => {
    const grouped = Object.fromEntries(
      CAMPAIGN_CHANNELS.map((ch) => [ch, []])
    );
    for (const log of communications ?? []) {
      const ch = CAMPAIGN_CHANNELS.includes(log.channel) ? log.channel : "email";
      grouped[ch].push(log);
    }
    return grouped;
  }, [communications]);

  const [activeTab, setActiveTab] = useState(CAMPAIGN_CHANNELS[0]);

  useEffect(() => {
    setActiveTab(CAMPAIGN_CHANNELS[0]);
  }, [campaignContactId]);

  const tabs = CAMPAIGN_CHANNELS;
  const activeLogs = byChannel[activeTab] ?? [];
  const whatsappWindowOpen =
    activeTab === "whatsapp" && prospect?.whatsappWindow?.windowOpen;

  return (
    <div className="flex flex-col min-h-0">
      {whatsappWindowOpen && (
        <div className="rounded-md bg-brand-sage/15 border border-brand-sage/30 px-3 py-2 mb-3 shrink-0">
          <p className="text-xs font-medium text-brand-ink">
            24-hour window for free messages available
          </p>
          {prospect.whatsappWindow.expiresAt && (
            <p className="text-xs text-brand-stone mt-0.5">
              Until{" "}
              {new Date(prospect.whatsappWindow.expiresAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-brand-secondary/30 mb-3 shrink-0">
        {tabs.map((ch) => {
          const count = byChannel[ch]?.length ?? 0;
          const active = activeTab === ch;
          const channelEnabled = enabledChannels.includes(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => setActiveTab(ch)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-brand-sage text-brand-ink"
                  : "border-transparent text-brand-stone hover:text-brand-stone"
              } ${!channelEnabled ? "opacity-50" : ""}`}
              title={
                channelEnabled
                  ? undefined
                  : `${CHANNEL_LABELS[ch]} is disabled for this campaign`
              }
            >
              {CHANNEL_LABELS[ch]}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-brand-sage/20 text-brand-terracotta"
                      : "bg-brand-bg text-brand-stone"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 mb-3">
        <ChannelThread logs={activeLogs} />
      </div>

      {copilotMode ? (
        <ContactCopilotComposer
          key={campaignContactId}
          channel={activeTab}
          channelEnabled={enabledChannels.includes(activeTab)}
          prospect={prospect}
          campaign={campaign}
          templates={templates}
          communications={communications ?? []}
          campaignId={campaignId}
          campaignContactId={campaignContactId}
          onSent={onSent}
        />
      ) : (
        <p className="text-xs text-brand-stone pt-3 border-t border-brand-secondary/25 shrink-0">
          Campaign is live — messages are sent by autopilot. Pause the campaign to
          send manually.
        </p>
      )}
    </div>
  );
}

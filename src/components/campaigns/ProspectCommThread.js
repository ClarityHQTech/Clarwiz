"use client";

import { CAMPAIGN_CHANNELS, CHANNEL_LABELS } from "@/lib/campaignConstants";
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

function OutboundBubble({ log }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-sky-50 border border-sky-100 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-medium text-sky-800">
            {log.stage != null ? `Stage ${log.stage}` : "Outbound"}
          </span>
          <span className="text-xs text-sky-600/70 capitalize">{log.status}</span>
          <span className="text-xs text-gray-400 ml-auto">
            {formatDateTime(log.sentAt)}
          </span>
        </div>
        {log.subject && (
          <p className="text-xs font-medium text-gray-800 mb-1">{log.subject}</p>
        )}
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.message}</p>
        {log.decisionReason && (
          <p className="text-xs text-gray-400 mt-1.5 italic">{log.decisionReason}</p>
        )}
      </div>
    </div>
  );
}

function ReplyBubble({ log }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-emerald-50 border border-emerald-100 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-medium text-emerald-800 capitalize">
            {log.responseType || "reply"}
          </span>
          <span className="text-xs text-gray-400 ml-auto">
            {formatDateTime(log.responseAt)}
          </span>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">
          {log.responseContent}
        </p>
      </div>
    </div>
  );
}

function ChannelThread({ logs }) {
  if (!logs.length) {
    return (
      <p className="text-sm text-gray-500 py-3 text-center">
        No messages on this channel yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {logs.map((log) => (
        <div key={log.id} className="space-y-2">
          {log.status !== "skipped" && <OutboundBubble log={log} />}
          {log.responseContent && <ReplyBubble log={log} />}
        </div>
      ))}
    </div>
  );
}

export default function ProspectCommThread({ communications }) {
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

  const activeChannels = useMemo(
    () => CAMPAIGN_CHANNELS.filter((ch) => byChannel[ch]?.length > 0),
    [byChannel]
  );

  const [activeTab, setActiveTab] = useState(CAMPAIGN_CHANNELS[0]);

  useEffect(() => {
    if (activeChannels.length && !activeChannels.includes(activeTab)) {
      setActiveTab(activeChannels[0]);
    }
  }, [activeChannels, activeTab]);

  if (!communications?.length) {
    return (
      <p className="text-sm text-gray-500 py-2">
        No messages yet. Run execution to plan outreach for this prospect.
      </p>
    );
  }

  const tabs = CAMPAIGN_CHANNELS;

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-3">
        {tabs.map((ch) => {
          const count = byChannel[ch]?.length ?? 0;
          const active = activeTab === ch;
          return (
            <button
              key={ch}
              type="button"
              onClick={() => setActiveTab(ch)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-sky-600 text-sky-800"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {CHANNEL_LABELS[ch]}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <ChannelThread logs={byChannel[activeTab] ?? []} />
    </div>
  );
}

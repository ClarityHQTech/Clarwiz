"use client";

import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCost(providerCost) {
  if (providerCost?.total_cost_usd == null) return null;
  const usd = Number(providerCost.total_cost_usd);
  if (Number.isNaN(usd)) return null;
  return `$${usd.toFixed(4)}`;
}

function CommLogCard({ log }) {
  const channelLabel = log.channelLabel ?? CHANNEL_LABELS[log.channel] ?? log.channel;
  const cost = formatCost(log.providerCost);
  const tokens = log.providerUsage?.total_tokens;

  return (
    <article className="rounded-lg border border-brand-secondary/30 bg-brand-surface p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-brand-ink truncate">
            {log.prospectName ?? "Prospect"}
          </p>
          <p className="text-xs text-brand-stone mt-0.5">
            {channelLabel}
            {log.stage != null ? ` · Stage ${log.stage}` : ""} ·{" "}
            <span className="capitalize">{log.status}</span>
          </p>
        </div>
        <time className="text-xs text-brand-steel whitespace-nowrap">
          {formatDateTime(log.sentAt)}
        </time>
      </div>

      {log.subject && (
        <p className="text-xs text-brand-stone">
          <span className="font-medium">Subject:</span> {log.subject}
        </p>
      )}

      {log.status !== "skipped" && log.message && (
        <p className="text-xs text-brand-ink whitespace-pre-wrap border-l-2 border-brand-sage/30 pl-2">
          {log.message}
        </p>
      )}

      {log.status === "skipped" && (
        <p className="text-xs text-brand-ink bg-brand-terracotta/15 rounded px-2 py-1">
          {log.message || log.decisionReason || "Skipped"}
        </p>
      )}

      {log.decisionReason && log.status !== "skipped" && (
        <p className="text-xs text-brand-stone italic">{log.decisionReason}</p>
      )}

      {log.responseContent && (
        <div className="rounded-md bg-brand-sage/20 border border-brand-sage/30 px-2.5 py-2">
          <p className="text-xs font-medium text-brand-ink capitalize mb-1">
            Reply {log.responseType ? `(${log.responseType})` : ""}
            {log.responseAt ? ` · ${formatDateTime(log.responseAt)}` : ""}
          </p>
          <p className="text-xs text-brand-ink whitespace-pre-wrap">
            {log.responseContent}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-stone pt-1 border-t border-brand-secondary/15">
        {log.modelUsed && <span>Model: {log.modelUsed}</span>}
        {tokens != null && <span>{tokens} tokens</span>}
        {cost && <span>{cost}</span>}
        {log.deliveryProvider && (
          <span className="capitalize">{log.deliveryProvider}</span>
        )}
        {log.ctaClickedAt && (
          <span>Link clicked {formatDateTime(log.ctaClickedAt)}</span>
        )}
      </div>
    </article>
  );
}

export default function CampaignCommLogsDrawer({
  isOpen,
  onClose,
  commLogs = [],
}) {
  const sorted = [...commLogs].sort((a, b) => {
    const ta = new Date(a.sentAt).getTime();
    const tb = new Date(b.sentAt).getTime();
    return tb - ta;
  });

  return (
    <Drawer placement="right" size="md" isOpen={isOpen} onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent className="!max-w-[560px] !bg-brand-surface">
        <DrawerCloseButton />
        <DrawerHeader className="text-sm font-semibold text-brand-ink border-b !bg-brand-surface">
          Activity log
          <p className="text-xs font-normal text-brand-stone mt-1">
            All communication logs, newest first
          </p>
        </DrawerHeader>
        <DrawerBody className="px-4 py-4 !bg-brand-surface">
          {sorted.length === 0 ? (
            <p className="text-sm text-brand-stone py-8 text-center">
              No activity yet. Run next-best-action to plan outreach.
            </p>
          ) : (
            <div className="space-y-3">
              {sorted.map((log) => (
                <CommLogCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

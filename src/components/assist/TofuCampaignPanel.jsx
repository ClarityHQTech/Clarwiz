"use client";

import Link from "next/link";
import AssistBadge from "./ui/AssistBadge";
import { KvGrid } from "./ui/AssistPrimitives";
import { fmtDate } from "./format";
import { ui } from "@/lib/brandUi";

function formatStatus(status) {
  if (!status) return null;
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function CampaignContextCard({ ctx }) {
  if (!ctx) return null;
  const campaign = ctx.campaign ?? {};
  const contact = ctx.contact ?? {};

  return (
    <div className={`${ui.cardSurface} overflow-hidden`}>
      <div className={`px-4 py-3 ${ui.tableToolbar}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={ui.label}>Clarwiz campaign</p>
            <p className="text-sm font-medium text-brand-ink mt-1">{campaign.name || "Campaign"}</p>
            {campaign.targetSegment ? (
              <p className="text-xs text-brand-stone mt-0.5 line-clamp-2">{campaign.targetSegment}</p>
            ) : null}
          </div>
          <AssistBadge variant="accent">TOFU → MOFU</AssistBadge>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-brand-secondary/15">
        <KvGrid
          items={[
            { label: "Outreach score", value: typeof ctx.score === "number" ? ctx.score : null },
            { label: "Enrollment status", value: formatStatus(ctx.status) },
            { label: "Qualified", value: ctx.qualifiedAt ? fmtDate(ctx.qualifiedAt) : null },
            { label: "Qualified reason", value: ctx.qualifiedReason },
            { label: "Persona", value: contact.persona?.replace(/_/g, " ") ?? null },
            { label: "Messages", value: ctx.commLogs?.length ?? 0 },
          ]}
        />
        {campaign.id ? (
          <Link href={`/campaigns/${campaign.id}`} className={`${ui.link} text-xs mt-3 inline-block`}>
            Open campaign →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function TofuCampaignPanel({ contexts = [], title = "Clarwiz outreach history" }) {
  const rows = Array.isArray(contexts) ? contexts.filter(Boolean) : [];
  if (!rows.length) return null;

  return (
    <div className="space-y-3">
      {rows.length > 1 ? (
        <p className={`${ui.label} normal-case tracking-wide`}>{title}</p>
      ) : null}
      {rows.map((ctx) => (
        <CampaignContextCard key={ctx.id} ctx={ctx} />
      ))}
    </div>
  );
}

"use client";

import { KvGrid } from "../ui/AssistPrimitives";
import { fmtAmount, fmtDate } from "../format";
import { ui } from "@/lib/brandUi";

function formatStageBand(band) {
  if (!band) return null;
  return band.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DealDetailsCard({ deal }) {
  if (!deal) return null;

  const items = [
    { label: "Pipeline", value: deal.pipeline },
    { label: "Close date", value: deal.closeDate ? fmtDate(deal.closeDate) : null },
    { label: "Stage band", value: formatStageBand(deal.stageBand) },
    { label: "Contract value", value: fmtAmount(deal.amount) },
    { label: "HubSpot deal ID", value: deal.hubspotDealId },
    { label: "Owner ID", value: deal.ownerId },
    { label: "Last synced", value: deal.syncedAt ? fmtDate(deal.syncedAt) : null },
    { label: "Created in Clarwiz", value: deal.createdAt ? fmtDate(deal.createdAt) : null },
  ];

  return (
    <div className={`${ui.cardSurface} p-4 sm:p-5 space-y-4`}>
      <div>
        <h2 className={ui.titleSm}>Deal details</h2>
        <p className={`${ui.body} mt-1`}>CRM metadata synced from HubSpot.</p>
      </div>

      {deal.description ? (
        <div>
          <p className={ui.label}>Description</p>
          <p className="text-sm text-brand-ink leading-relaxed mt-2 whitespace-pre-wrap">{deal.description}</p>
        </div>
      ) : (
        <p className={`${ui.body} italic`}>No description on this deal yet.</p>
      )}

      <KvGrid items={items} />
    </div>
  );
}

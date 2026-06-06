"use client";

const STYLES = {
  connected: "bg-green-100 text-green-700 ring-green-600/25",
  checkpoint_required:
    "bg-brand-terracotta/15 text-brand-ink ring-brand-terracotta/40",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
  pending: "bg-brand-bg text-brand-stone ring-brand-steel/30",
  not_configured: "bg-brand-bg text-brand-stone ring-brand-steel/30",
  coming_soon: "bg-brand-bg text-brand-stone ring-brand-steel/20",
  error: "bg-red-50 text-red-700 ring-red-600/20",
};

const LABELS = {
  connected: "Connected",
  checkpoint_required: "Verification required",
  failed: "Connection issue",
  pending: "Pending",
  not_configured: "Not configured",
  coming_soon: "Coming soon",
  error: "Error",
};

export default function IntegrationStatusBadge({ status }) {
  const key = status in STYLES ? status : "not_configured";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[key]}`}
    >
      {LABELS[key] ?? status}
    </span>
  );
}

export function getLinkedInDisplayStatus(integration) {
  if (!integration?.status) return "not_configured";
  return integration.status;
}

export function getEmailDisplayStatus(integration) {
  if (!integration) return "not_configured";
  if (
    integration.mode === "smartlead_inbox" &&
    integration.status === "connected"
  ) {
    return "connected";
  }
  if (integration.status === "failed") return "failed";
  if (integration.hasSmartleadAccount || integration.status === "pending")
    return "pending";
  return "not_configured";
}

export function getWhatsAppDisplayStatus(integration) {
  if (!integration) return "not_configured";
  if (integration.status === "connected") return "connected";
  if (integration.status === "failed") return "failed";
  if (integration.status === "pending") return "pending";
  return "not_configured";
}

export function getCalendlyDisplayStatus(integration) {
  if (!integration) return "not_configured";
  if (integration.status === "connected") return "connected";
  if (integration.status === "error") return "failed";
  if (integration.status === "pending") return "pending";
  return "not_configured";
}

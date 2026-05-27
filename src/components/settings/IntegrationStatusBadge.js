"use client";

const STYLES = {
  connected: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  checkpoint_required: "bg-amber-50 text-amber-700 ring-amber-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
  pending: "bg-gray-50 text-gray-600 ring-gray-500/20",
  not_configured: "bg-gray-50 text-gray-600 ring-gray-500/20",
  coming_soon: "bg-gray-100 text-gray-500 ring-gray-400/30",
};

const LABELS = {
  connected: "Connected",
  checkpoint_required: "Verification required",
  failed: "Connection issue",
  pending: "Pending",
  not_configured: "Not configured",
  coming_soon: "Coming soon",
};

export default function IntegrationStatusBadge({ status }) {
  const key = status in STYLES ? status : "not_configured";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[key]}`}
    >
      {LABELS[key]}
    </span>
  );
}

export function getLinkedInDisplayStatus(integration) {
  if (!integration?.status) return "not_configured";
  return integration.status;
}

export function getEmailDisplayStatus(integration) {
  if (!integration) return "not_configured";
  if (integration.mode === "smartlead_inbox" && integration.status === "connected") {
    return "connected";
  }
  if (integration.status === "failed") return "failed";
  if (integration.hasSmartleadAccount || integration.status === "pending") return "pending";
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

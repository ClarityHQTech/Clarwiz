/**
 * Recommended DNS records for cold email deliverability + Smartlead tracking.
 * @see https://api.smartlead.ai/guides/best-practices
 */

export function extractDomainFromEmail(email) {
  const part = email?.split("@")[1]?.trim().toLowerCase();
  return part || null;
}

export function buildDnsRecords({ sendingDomain, trackingHost }) {
  if (!sendingDomain) return [];

  const track =
    trackingHost?.trim() ||
    `track.${sendingDomain.replace(/^\.+/, "")}`;
  const trackLabel = track.includes(".")
    ? track.replace(new RegExp(`\\.?${sendingDomain.replace(/\./g, "\\.")}$`), "") ||
      "track"
    : track;

  const records = [
    {
      id: "spf",
      type: "TXT",
      host: "@",
      value: "v=spf1 include:_spf.google.com ~all",
      note: "Adjust includes for your mailbox provider (Google, Microsoft, etc.).",
    },
    {
      id: "dmarc",
      type: "TXT",
      host: "_dmarc",
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${sendingDomain}`,
      note: "Start with p=none; move to quarantine/reject once deliverability is stable.",
    },
    {
      id: "dkim",
      type: "TXT",
      host: "google._domainkey",
      value: "(generate in Google Admin / Microsoft 365 / your DNS provider)",
      note: "DKIM host and value come from your email provider — not from Smartlead.",
    },
    {
      id: "tracking",
      type: "CNAME",
      host: trackLabel || "track",
      value: `Configure in Smartlead after setting custom tracking domain: ${track}`,
      note: "In Smartlead: Email Accounts → your inbox → Custom Tracking Domain. Copy the CNAME target Smartlead shows, then paste it here at your registrar.",
    },
  ];

  return records;
}

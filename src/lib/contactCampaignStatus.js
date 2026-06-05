export const CONTACT_CAMPAIGN_STATUS_LABELS = {
  PENDING: "Pending",
  IN_OUTREACH: "In outreach",
  REPLIED: "Replied",
  QUALIFIED: "Qualified",
  NOT_QUALIFIED: "Not qualified",
  DISQUALIFIED: "Disqualified",
  PAUSED: "Paused",
};

export const CONTACT_CAMPAIGN_STATUS_BADGE = {
  PENDING: "text-brand-steel",
  IN_OUTREACH: "text-amber-700",
  REPLIED: "text-amber-700",
  QUALIFIED: "text-emerald-700",
  NOT_QUALIFIED: "text-brand-steel",
  DISQUALIFIED: "text-red-700",
  PAUSED: "text-brand-steel",
};

export const TERMINAL_CONTACT_CAMPAIGN_STATUSES = new Set([
  "QUALIFIED",
  "NOT_QUALIFIED",
  "DISQUALIFIED",
  "PAUSED",
]);

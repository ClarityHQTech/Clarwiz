// Shared option/label maps for the Collateral Hub UI. Mirrors the Prisma
// CollateralType / CollateralSrc / FunnelStage enums (schema is frozen).

export const TYPE_OPTIONS = [
  { value: "MARKETING_DOC", label: "Marketing doc" },
  { value: "PITCH_DECK", label: "Pitch deck" },
  { value: "BATTLECARD", label: "Battlecard" },
  { value: "ONE_PAGER", label: "One-pager" },
  { value: "CASE_STUDY", label: "Case study" },
  { value: "EMAIL_TEMPLATE", label: "Email template" },
  { value: "OTHER", label: "Other" },
];

export const SOURCE_OPTIONS = [
  { value: "GENERATED", label: "Generated", color: "purple" },
  { value: "HEYPARROT", label: "HeyParrot", color: "green" },
  { value: "PILOT", label: "Pilot", color: "blue" },
  { value: "UPLOAD", label: "Upload", color: "gray" },
];

export const STAGE_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "DEAL_EARLY", label: "Deal — early" },
  { value: "DEAL_LATE", label: "Deal — late" },
  { value: "ANY", label: "Any stage" },
];

export const TYPE_LABELS = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));
export const STAGE_LABELS = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.value, o.label]));
export const SOURCE_LABELS = Object.fromEntries(SOURCE_OPTIONS.map((o) => [o.value, o.label]));
export const SOURCE_COLORS = Object.fromEntries(SOURCE_OPTIONS.map((o) => [o.value, o.color]));

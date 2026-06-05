export const CONTACT_PERSONA_LABELS = {
  DECISION_MAKER: "Decision maker",
  INFLUENCER: "Influencer",
  CHAMPION: "Champion",
  GATEKEEPER: "Gatekeeper",
  ECONOMIC_BUYER: "Economic buyer",
  TECHNICAL_BUYER: "Technical buyer",
  END_USER: "End user",
  OTHER: "Other",
};

const PERSONA_ALIASES = {
  decision_maker: "DECISION_MAKER",
  "decision maker": "DECISION_MAKER",
  decisionmaker: "DECISION_MAKER",
  influencer: "INFLUENCER",
  champion: "CHAMPION",
  gatekeeper: "GATEKEEPER",
  economic_buyer: "ECONOMIC_BUYER",
  "economic buyer": "ECONOMIC_BUYER",
  technical_buyer: "TECHNICAL_BUYER",
  "technical buyer": "TECHNICAL_BUYER",
  end_user: "END_USER",
  "end user": "END_USER",
  other: "OTHER",
};

export function normalizeContactPersona(value) {
  if (!value?.trim()) return "OTHER";
  const key = value.trim().toLowerCase().replace(/\s+/g, " ");
  const direct = key.toUpperCase().replace(/ /g, "_");
  if (CONTACT_PERSONA_LABELS[direct]) return direct;
  return PERSONA_ALIASES[key] ?? "OTHER";
}

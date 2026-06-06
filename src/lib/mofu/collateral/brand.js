// Brand cascade: defaults -> tenant -> client (US-7.1). Deterministic.
export const DEFAULT_BRAND = {
  companyName: "Clarwiz",
  primaryColor: "#1a1a1a",
  accentColor: "#e07a5f",
  fontFamily: "Inter, system-ui, sans-serif",
  logoUrl: null,
};

export function resolveBrand({ tenant = null, client = null } = {}) {
  return {
    ...DEFAULT_BRAND,
    ...(tenant ? Object.fromEntries(Object.entries(tenant).filter(([, v]) => v != null)) : {}),
    ...(client ? Object.fromEntries(Object.entries(client).filter(([, v]) => v != null)) : {}),
  };
}

import { prisma as defaultPrisma } from "@/lib/prisma";
import { getHubSpotIntegration, isHubSpotConnected } from "@/lib/hubspot/hubspotIntegration";
import { ACTION_REQUIRED_CAPABILITY } from "@/lib/mofu/nbaActions";

// US-5.1 — Discover HubSpot-connected capabilities and gate NBA cards.
// Fail closed: unknown/not-connected -> capability absent -> "Connect X" CTA.

const CAPABILITY_SCOPE_HINTS = {
  EMAIL: ["sales-email", "crm.objects.contacts"],
  CALLING: ["calls", "communication_preferences"],
  MEETING_SCHEDULER: ["meetings", "scheduler"],
  NOTE_TAKER: ["notes", "calls"],
};

/** Derive capability presence from connection + granted scopes (proxy discovery). */
export function deriveCapabilities(integration) {
  const connected = isHubSpotConnected(integration);
  const scopes = integration?.scopes ?? [];
  const present = {};
  for (const [cap, hints] of Object.entries(CAPABILITY_SCOPE_HINTS)) {
    present[cap] = connected && hints.some((h) => scopes.some((s) => s.includes(h)));
  }
  return present;
}

export async function discoverCapabilities(tenantId, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const integration = await getHubSpotIntegration(tenantId, deps);
  const present = deriveCapabilities(integration);

  const rows = [];
  for (const [capability, isPresent] of Object.entries(present)) {
    const row = await prisma.tenantCapability.upsert({
      where: { tenantId_capability: { tenantId, capability } },
      create: { tenantId, capability, present: isPresent, detail: { source: "hubspot_scopes" } },
      update: { present: isPresent, detail: { source: "hubspot_scopes" }, discoveredAt: new Date() },
    });
    rows.push(row);
  }
  return { present, capabilities: rows };
}

/**
 * Gate a single NBA card. Returns { executable, requiredCapability, cta }.
 * Actions needing no capability are always executable.
 */
export function gateCard(actionType, presentMap = {}) {
  const required = ACTION_REQUIRED_CAPABILITY[actionType];
  if (!required) return { executable: true, requiredCapability: null, cta: null };
  const executable = !!presentMap[required];
  return {
    executable,
    requiredCapability: required,
    cta: executable ? null : `Connect ${required} to HubSpot`,
  };
}

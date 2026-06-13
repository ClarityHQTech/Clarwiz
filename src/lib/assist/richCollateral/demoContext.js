/**
 * Pre-fed demo scenarios for the Collateral Demo Lab (prospect/deal only).
 * Tenant name is always taken from the workspace DB at render time.
 */

export const DEMO_SCENARIOS = {
  acme_discovery: {
    id: "acme_discovery",
    label: "Acme Robotics — Discovery (VP Sales)",
    description: "Mid-market manufacturing buyer evaluating sales intelligence.",
    prospect: { name: "Acme Robotics", industry: "Industrial automation" },
    contact: { name: "Jordan Lee", title: "VP Sales" },
    deal: { stage: "Discovery" },
  },
  northstar_late: {
    id: "northstar_late",
    label: "Northstar Health — Late stage (CRO)",
    description: "Healthcare SaaS CRO comparing platforms vs incumbent stack.",
    prospect: { name: "Northstar Health", industry: "Healthcare SaaS" },
    contact: { name: "Priya Nair", title: "Chief Revenue Officer" },
    deal: { stage: "Proposal" },
  },
};

export const DEFAULT_DEMO_SCENARIO_ID = "acme_discovery";

export function getDemoScenario(id) {
  return DEMO_SCENARIOS[id] || DEMO_SCENARIOS[DEFAULT_DEMO_SCENARIO_ID];
}

export function listDemoScenarios() {
  return Object.values(DEMO_SCENARIOS).map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}

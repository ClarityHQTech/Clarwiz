// Closed NBA action set (PRD §8). The jury ranks/parameterizes; it never invents a type.
export const NBA_ACTION_TYPES = [
  "SEND_EMAIL",
  "SEND_MARKETING_COLLATERAL",
  "SEND_SALES_COLLATERAL",
  "SCHEDULE_MEETING",
  "CALL_WITH_SCRIPT",
  "PREP_MEETING",
  "UPDATE_CRM_CREATE_TASK",
  "NOTIFY_TEAM",
];

// Which HubSpot-discovered capability an executor needs (US-5.1 gating).
// Actions absent here need no external capability (always executable).
export const ACTION_REQUIRED_CAPABILITY = {
  SEND_EMAIL: "EMAIL",
  SEND_MARKETING_COLLATERAL: "EMAIL",
  SEND_SALES_COLLATERAL: "EMAIL",
  SCHEDULE_MEETING: "MEETING_SCHEDULER",
  CALL_WITH_SCRIPT: "CALLING",
};

// Outbound actions that MUST pass the approve gate before sending (US-6.1).
export const OUTBOUND_ACTIONS = new Set([
  "SEND_EMAIL",
  "SEND_MARKETING_COLLATERAL",
  "SEND_SALES_COLLATERAL",
  "SCHEDULE_MEETING",
  "NOTIFY_TEAM",
]);

export function isClosedActionType(t) {
  return NBA_ACTION_TYPES.includes(t);
}

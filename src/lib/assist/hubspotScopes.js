/** HubSpot OAuth scopes used by AE Assist recording / engagement features. */
export const HUBSPOT_SCOPES = {
  TRANSCRIPTS_READ: "crm.extensions_calling_transcripts.read",
  CALLS_READ: "crm.objects.calls.read",
  APPOINTMENTS_READ: "crm.objects.appointments.read",
};

export function hasHubspotScope(scopes, scopeName) {
  return Array.isArray(scopes) && scopes.includes(scopeName);
}

export function assessRecordingScopes(scopes = []) {
  return {
    hasTranscriptsRead: hasHubspotScope(scopes, HUBSPOT_SCOPES.TRANSCRIPTS_READ),
    hasCallsRead: hasHubspotScope(scopes, HUBSPOT_SCOPES.CALLS_READ),
    hasAppointmentsRead: hasHubspotScope(scopes, HUBSPOT_SCOPES.APPOINTMENTS_READ),
  };
}

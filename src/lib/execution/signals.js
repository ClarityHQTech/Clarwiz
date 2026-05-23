/** Default live signal for execution test harness */
export const DEFAULT_TEST_SIGNAL = {
  type: "linkedin_post",
  source: "linkedin",
  content: "New office opening at Gurugram (LinkedIn post)",
};

export function serializeProspectSignals(signals) {
  return (signals ?? []).map((s) => ({
    id: s.id,
    type: s.type,
    source: s.source,
    content: s.content,
    detectedAt: s.createdAt?.toISOString?.() ?? s.createdAt,
  }));
}

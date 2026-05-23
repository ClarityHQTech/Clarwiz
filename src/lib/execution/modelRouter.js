const MODEL_SIMPLE =
  process.env.OPENAI_MODEL_SIMPLE || "gpt-4o-mini";
const MODEL_COMPLEX =
  process.env.OPENAI_MODEL_COMPLEX || "gpt-4o";

/**
 * Pick OpenAI model based on prospect execution context complexity.
 */
export function selectModel({ commHistory, hasRecentReply, signalCount = 0 }) {
  const logCount = commHistory.length;
  const hasReply = hasRecentReply || commHistory.some((l) => l.responseType);

  if (hasReply || logCount >= 4 || signalCount > 0) {
    return { model: MODEL_COMPLEX, tier: "complex" };
  }
  if (logCount >= 2) {
    return { model: MODEL_COMPLEX, tier: "moderate" };
  }
  return { model: MODEL_SIMPLE, tier: "simple" };
}

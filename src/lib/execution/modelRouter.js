import {
  ANTHROPIC_MODEL_SIMPLE,
  ANTHROPIC_MODEL_COMPLEX,
} from "@/lib/anthropicClient";

const MODEL_SIMPLE = ANTHROPIC_MODEL_SIMPLE;
const MODEL_COMPLEX = ANTHROPIC_MODEL_COMPLEX;

/**
 * Pick Claude model based on prospect execution context complexity.
 */
export function selectModel({ commHistory, hasRecentReply, signalCount = 0 }) {
  const logCount = commHistory.length;
  const hasReply =
    hasRecentReply || commHistory.some((l) => l.responseType === "reply");

  if (hasReply || logCount >= 4 || signalCount > 0) {
    return { model: MODEL_COMPLEX, tier: "complex" };
  }
  if (logCount >= 2) {
    return { model: MODEL_COMPLEX, tier: "moderate" };
  }
  return { model: MODEL_SIMPLE, tier: "simple" };
}

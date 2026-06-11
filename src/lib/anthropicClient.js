import Anthropic from "@anthropic-ai/sdk";

let client;

/** Lazily-constructed Anthropic SDK client (reads ANTHROPIC_API_KEY). */
export function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Default Claude model for the MOFU AE-assist agent. */
export const ASSIST_AGENT_MODEL = "claude-opus-4-8";

/** Fast/cheap model for JSON prompts, drafts, and simple classification. */
export const ANTHROPIC_MODEL_SIMPLE =
  process.env.ANTHROPIC_MODEL_SIMPLE?.trim() || "claude-haiku-4-5";

/** Stronger model for complex execution decisions and multi-turn context. */
export const ANTHROPIC_MODEL_COMPLEX =
  process.env.ANTHROPIC_MODEL_COMPLEX?.trim() || "claude-sonnet-4-5";

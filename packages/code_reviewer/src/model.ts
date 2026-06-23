import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type LanguageModel } from "ai";

/**
 * Default model id on OpenRouter. Override with `OPENROUTER_MODEL`.
 *
 * `openrouter/free` is a zero-cost router that picks a free model at random.
 * Verified to advertise `tools` / `structured_outputs` support, so it works
 * with the `Output.object` structured-output call in `reviewCode`.
 */
export const DEFAULT_MODEL = "openrouter/free";

/** Reads a required environment variable or throws a clear error. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Builds a configured OpenRouter language model.
 * Uses `OPENROUTER_API_KEY` and, optionally, `OPENROUTER_MODEL`.
 */
export function getModel(modelId: string = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL): LanguageModel {
  const openrouter = createOpenRouter({ apiKey: requireEnv("OPENROUTER_API_KEY") });
  return openrouter(modelId);
}

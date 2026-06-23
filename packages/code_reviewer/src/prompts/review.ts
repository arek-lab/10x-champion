/**
 * Review prompt wording, kept separate from the agent wiring so prompts can be
 * iterated on (and eval-compared) without touching the model/agent setup.
 */

/** System/instructions text guiding the reviewer's behavior. */
export const reviewInstructions =
  'You are a senior code reviewer. Identify bugs, risks and concrete ' +
  'improvements. Be precise and reference line numbers when possible.';

/** Builds the per-call prompt body for a review, with an optional language hint. */
export function buildReviewPrompt(code: string, language?: string): string {
  return `Review the following${language ? ` ${language}` : ''} code:\n\n${code}`;
}

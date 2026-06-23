/**
 * Public barrel for the AI-powered code reviewer.
 *
 * Re-exports the lazy `ToolLoopAgent` accessor, the `reviewCode` convenience,
 * the OpenRouter model seam, and the structured-output schemas/types. A future
 * promptfoo eval can drive the reviewer through this surface with no re-export
 * churn.
 *
 * This barrel is side-effect-free: importing the package performs no I/O, no
 * model call, and does not require `OPENROUTER_API_KEY` — the agent is built
 * lazily on the first `reviewCode()` / `getCodeReviewerAgent()` call. The
 * runnable entrypoint lives in `cli.ts`.
 */
export { getCodeReviewerAgent, reviewCode } from './agents/code-reviewer.js';
export { getModel, DEFAULT_MODEL } from './model.js';
export { findingSchema, reviewSchema } from './schemas/review.js';
export type { Finding, Review } from './schemas/review.js';

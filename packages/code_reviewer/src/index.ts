/**
 * Public barrel for the AI-powered code reviewer.
 *
 * Re-exports the lazy `ToolLoopAgent` accessor, the `reviewCode` /
 * `reviewPullRequest` conveniences, the OpenRouter model seam, and the
 * structured-output schemas/types. A future promptfoo eval can drive the
 * reviewer through this surface with no re-export churn.
 *
 * This barrel is side-effect-free: importing the package performs no I/O, no
 * model call, and does not require `OPENROUTER_API_KEY` — the agent is built
 * lazily on the first `reviewCode()` / `reviewPullRequest()` call. The runnable
 * entrypoints live in `cli.ts` (single file) and `review-pr.ts` (a PR diff).
 */
export { getCodeReviewerAgent, reviewCode, reviewPullRequest } from "./agents/code-reviewer.js";
export { getModel, DEFAULT_MODEL } from "./model.js";
export { buildPullRequestPrompt, type PullRequestInput } from "./prompts/review.js";
export { findingSchema, criterionScoreSchema, reviewSchema, CRITERIA } from "./schemas/review.js";
export type { Finding, CriterionScore, Criterion, Review } from "./schemas/review.js";

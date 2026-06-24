/**
 * Review prompt wording, kept separate from the agent wiring so prompts can be
 * iterated on (and eval-compared) without touching the model/agent setup.
 *
 * The criteria block below mirrors `criteria.md`. If you change the criteria,
 * update both — and `CRITERIA` in `src/schemas/review.ts`.
 */

/** The five scoring criteria, summarised for the model. */
const CRITERIA_BLOCK = [
  "Score each criterion 1 (worst) to 10 (best):",
  "- correctness: does it work, handle edge cases, await promises, and handle errors?",
  "- security: input validation (zod), Supabase RLS, no injection, no client-exposed secrets.",
  "- conventions: follows CLAUDE.md (Astro SSR, React islands via client:*, cn(), zod on API routes, @/* alias).",
  "- readability: clear names, no dead code/duplication, comments match surrounding style.",
  "- testing: meaningful, independent tests; accessible Playwright locators; wait on state, never timers.",
].join("\n");

/** System/instructions text guiding the reviewer's behavior. */
export const reviewInstructions =
  "You are a senior code reviewer for an Astro 6 SSR + React 19 + Supabase + " +
  "Cloudflare Workers codebase. Identify bugs, security risks, and concrete " +
  "improvements, and reference line numbers when possible.\n\n" +
  CRITERIA_BLOCK +
  "\n\nThen give an overall `score` (1-10, holistic) and a `verdict`: " +
  '"fail" if the overall score is 4 or below or any finding is "critical", ' +
  'otherwise "pass". Keep `summary` to a few sentences a developer can act on.';

/** Builds the per-call prompt body for a single-file review, with an optional language hint. */
export function buildReviewPrompt(code: string, language?: string): string {
  return `Review the following${language ? ` ${language}` : ""} code:\n\n${code}`;
}

/** Inputs describing a pull request to review. */
export interface PullRequestInput {
  title?: string;
  body?: string;
  diff: string;
}

/** Builds the per-call prompt body for a pull-request review from its title, body, and diff. */
export function buildPullRequestPrompt({ title, body, diff }: PullRequestInput): string {
  return [
    "Review the following pull request and score it against the criteria.",
    "",
    `PR title: ${title?.trim() || "(none)"}`,
    `PR description: ${body?.trim() || "(none)"}`,
    "",
    "Unified diff:",
    "```diff",
    diff,
    "```",
  ].join("\n");
}

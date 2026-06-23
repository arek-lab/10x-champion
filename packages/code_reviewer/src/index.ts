import { pathToFileURL } from 'node:url';
import { reviewCode } from './agents/code-reviewer.js';

/**
 * Public barrel for the AI-powered code reviewer.
 *
 * Re-exports the reusable `ToolLoopAgent` instance, the `reviewCode` convenience,
 * the OpenRouter model seam, and the structured-output schemas/types. A future
 * promptfoo eval can drive the reviewer through this surface with no re-export
 * churn.
 *
 * NOTE: the `main()` smoke test + entry guard below is transitional (Phase 2
 * runtime verification only). Phase 3 removes it so this barrel becomes
 * side-effect-free, relocating the script-detection logic into `cli.ts`.
 */
export { codeReviewerAgent, reviewCode } from './agents/code-reviewer.js';
export { getModel, DEFAULT_MODEL } from './model.js';
export { findingSchema, reviewSchema } from './schemas/review.js';
export type { Finding, Review } from './schemas/review.js';

/** Minimal smoke test executed only when this file is run directly. */
async function main(): Promise<void> {
  const sample = [
    'function div(a, b) {',
    '  return a / b;',
    '}',
  ].join('\n');

  const review = await reviewCode(sample, 'javascript');
  console.log(JSON.stringify(review, null, 2));
}

// Run `main` only when executed as a script, not when imported (cross-platform).
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

import { pathToFileURL } from 'node:url';
import { generateText, Output } from 'ai';
import { getModel, DEFAULT_MODEL } from './model.js';
import { reviewInstructions, buildReviewPrompt } from './prompts/review.js';
import { findingSchema, reviewSchema, type Finding, type Review } from './schemas/review.js';

/**
 * Basic entry point for the AI-powered code reviewer.
 *
 * Wires the Vercel AI SDK to the OpenRouter provider and exposes a small,
 * typed surface (`getModel`, `reviewCode`) intended as a foundation for
 * further integration. Run directly (`npm run start`) for a quick smoke test.
 */

// Re-export the moved surface so the package entry is unchanged at this phase
// boundary. Phase 2 converts `reviewCode` to a `ToolLoopAgent` and turns this
// file into the public barrel.
export { getModel, DEFAULT_MODEL };
export { findingSchema, reviewSchema };
export type { Finding, Review };

/**
 * Reviews a snippet of code and returns a structured, validated result.
 *
 * @param code     The source code to review.
 * @param language Optional language hint (e.g. "typescript").
 */
export async function reviewCode(code: string, language?: string): Promise<Review> {
  const { output } = await generateText({
    model: getModel(),
    system: reviewInstructions,
    prompt: buildReviewPrompt(code, language),
    output: Output.object({ schema: reviewSchema }),
  });

  return output;
}

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

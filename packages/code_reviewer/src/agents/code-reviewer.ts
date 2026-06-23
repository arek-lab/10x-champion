import { ToolLoopAgent, Output } from 'ai';
import { getModel } from '../model.js';
import { reviewInstructions, buildReviewPrompt } from '../prompts/review.js';
import { reviewSchema, type Review } from '../schemas/review.js';

/**
 * The structured-output spec the agent carries. Naming it explicitly (the AI SDK
 * exports the `Output` type only as a member of the `Output` namespace) lets the
 * exported agent type be emitted into the `.d.ts` under `declaration: true` —
 * without it, tsc fails with TS4023 because the inferred type references an
 * un-nameable `Output` interface.
 */
type ReviewOutput = Output.Output<Review>;

/** Memoized singleton — see `getCodeReviewerAgent`. */
let cachedAgent: ToolLoopAgent<never, {}, ReviewOutput> | undefined;

/**
 * Returns the shared code-reviewer agent, constructing it on first use and
 * reusing it thereafter. Construction is **lazy** (not at module load) so that
 * importing the library barrel is side-effect-free: a consumer that only wants
 * the schemas/types never triggers `getModel()` or requires `OPENROUTER_API_KEY`.
 * The agent is tool-free, relying on `Output.object` for a validated,
 * schema-typed `Review`. A future promptfoo provider can wrap this accessor or
 * the `reviewCode` convenience below.
 */
export function getCodeReviewerAgent(): ToolLoopAgent<never, {}, ReviewOutput> {
  cachedAgent ??= new ToolLoopAgent({
    model: getModel(),
    instructions: reviewInstructions,
    output: Output.object({ schema: reviewSchema }),
  });

  return cachedAgent;
}

/**
 * Reviews a snippet of code and returns a structured, validated result.
 *
 * @param code     The source code to review.
 * @param language Optional language hint (e.g. "typescript").
 */
export async function reviewCode(code: string, language?: string): Promise<Review> {
  const { output } = await getCodeReviewerAgent().generate({
    prompt: buildReviewPrompt(code, language),
  });

  return output;
}

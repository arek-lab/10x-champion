import { ToolLoopAgent, Output } from 'ai';
import { getModel } from '../model.js';
import { reviewInstructions, buildReviewPrompt } from '../prompts/review.js';
import { reviewSchema, type Review } from '../schemas/review.js';

/**
 * The structured-output spec the agent carries. Naming it explicitly (the AI SDK
 * exports the `Output` type only as a member of the `Output` namespace) lets the
 * exported `codeReviewerAgent` type be emitted into the `.d.ts` under
 * `declaration: true` — without it, tsc fails with TS4023 because the inferred
 * type references an un-nameable `Output` interface.
 */
type ReviewOutput = Output.Output<Review>;

/**
 * The code reviewer, defined once as a reusable `ToolLoopAgent` with structured
 * output. Constructed at module load so every `reviewCode` call reuses the same
 * agent and provider. Tool-free: it relies on `Output.object` for a validated,
 * schema-typed `Review`. A future promptfoo provider can wrap either this agent
 * instance or the `reviewCode` convenience below.
 */
export const codeReviewerAgent: ToolLoopAgent<never, {}, ReviewOutput> = new ToolLoopAgent({
  model: getModel(),
  instructions: reviewInstructions,
  output: Output.object({ schema: reviewSchema }),
});

/**
 * Reviews a snippet of code and returns a structured, validated result.
 *
 * @param code     The source code to review.
 * @param language Optional language hint (e.g. "typescript").
 */
export async function reviewCode(code: string, language?: string): Promise<Review> {
  const { output } = await codeReviewerAgent.generate({
    prompt: buildReviewPrompt(code, language),
  });

  return output;
}

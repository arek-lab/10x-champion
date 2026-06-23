# Tool Loop Agent — Modular Code Reviewer Implementation Plan

## Overview

Convert the single-file `packages/code_reviewer/src/index.ts` (97 lines) into a
well-organized, modular code-review agent built on the AI SDK's `ToolLoopAgent`.
Schemas and prompts move into their own modules, the OpenRouter provider wiring
is isolated behind a `model.ts` seam, and the reviewer is rebuilt as a reusable
`ToolLoopAgent` instance exposed through a barrel `index.ts`. The public surface
(agent instance + `reviewCode()` + schemas/types) is shaped so a future
promptfoo eval can drive the reviewer without re-export churn. Behavior — a
validated `Review` object from one structured-output generation — is preserved.

## Current State Analysis

`src/index.ts` does five jobs in one file:

- **Provider/model wiring** — `DEFAULT_MODEL = 'openrouter/free'`, `requireEnv()`,
  and `getModel()` (builds an OpenRouter `LanguageModel` from `OPENROUTER_API_KEY`,
  optional `OPENROUTER_MODEL`). (`src/index.ts:21`, `:41`, `:53`)
- **Schemas** — `findingSchema`, `reviewSchema`, and inferred `Finding` / `Review`
  types. (`src/index.ts:24`, `:32`, `:37`)
- **Review logic** — `reviewCode(code, language?)` calls `generateText` with a
  `system` string + `Output.object({ schema: reviewSchema })`. **Not** a
  `ToolLoopAgent`; no tools. (`src/index.ts:64`)
- **Smoke test** — `main()` reviews a sample snippet, printed when the file is run
  directly via a cross-platform `import.meta.url` entry guard. (`src/index.ts:78`, `:90`)

Constraints discovered:

- **`ToolLoopAgent` is the current API** (exported from `ai`, also aliased
  `Experimental_Agent`). Constructor: `new ToolLoopAgent({ model, instructions,
  tools?, output?, stopWhen?, toolChoice? })`. It accepts the same call settings
  as `generateText`/`streamText`. (`node_modules/ai/docs/03-agents/02-building-agents.mdx`)
- **Structured output works tool-free**: `output: Output.object({ schema })` in
  the constructor, consumed via `await agent.generate({ prompt })` → `{ output }`,
  typed to the schema. The docs' `analysisAgent` example does exactly this with no
  tools. (`building-agents.mdx:162-181`)
- The agent's `instructions` field replaces the old `generateText` `system` string.
- The agent accepts a `LanguageModel` instance, so the existing OpenRouter
  `getModel()` plugs straight in — no provider change.
- **tsconfig** sets `verbatimModuleSyntax: true` and `noUncheckedIndexedAccess: true`
  → type-only imports MUST use `import type`; the existing `import { ..., type
  LanguageModel } from 'ai'` mixed form is already correct and must be preserved
  per-symbol. ESM + NodeNext: relative imports need explicit `.js` extensions
  (e.g. `import { reviewSchema } from './schemas/review.js'`).
- The AI SDK skill's recommended structure is `agents/` + `tools/` co-located dirs
  (`references/type-safe-agents.md`).

## Desired End State

`src/` is split into focused modules; `reviewCode()` is backed by a reusable
`ToolLoopAgent` instance; the barrel `index.ts` re-exports the public API and
retains a thin smoke test. `npm run typecheck` and `npm start` behave exactly as
before (a validated `Review` is produced and printed). The agent instance is
importable for a future promptfoo provider with no further refactor.

### Key Discoveries:

- `ToolLoopAgent` + `Output.object` replaces `generateText` + `Output.object`
  one-to-one; `system` → `instructions`. (`building-agents.mdx:162`)
- `agent.generate({ prompt })` returns `{ output }` typed to the schema. (`building-agents.mdx:178`)
- `verbatimModuleSyntax` + NodeNext require `import type` and `.js` extensions on
  relative specifiers. (`tsconfig.json:12`, `:4`)
- OpenRouter `getModel()` returns a `LanguageModel` the agent consumes directly.
  (`src/index.ts:53`)

## What We're NOT Doing

- **Not** configuring the promptfoo/eval environment (no `promptfooconfig.yaml`,
  no eval deps, no provider adapter file). We only shape the exports so it's
  possible later.
- **Not** switching providers — OpenRouter and `openrouter/free` stay; no new deps,
  no `.env` changes.
- **Not** adding tools — the agent stays tool-free structured-output for now.
- **Not** adding a test runner, CI, or unit tests (none exist in this package).
- **Not** changing the `Review`/`Finding` schema shape, the model default, or the
  `npm` scripts.

## Implementation Approach

Two phases, each independently typecheck-verifiable. Phase 1 extracts the leaf
modules (schemas, prompts, model) as near-verbatim moves — no behavior change,
`index.ts` keeps importing from them and stays green. Phase 2 introduces the
`ToolLoopAgent` in `agents/code-reviewer.ts`, moves `reviewCode()` onto it, and
rewrites `index.ts` as the re-export barrel + thin smoke test. Splitting this way
means a regression in "extract" is isolated from a regression in "convert to
agent."

Final layout:

```
src/
  model.ts                 # requireEnv, DEFAULT_MODEL, getModel (OpenRouter)
  schemas/
    review.ts              # findingSchema, reviewSchema, Finding, Review
  prompts/
    review.ts              # review instructions + prompt builder
  agents/
    code-reviewer.ts       # codeReviewerAgent (ToolLoopAgent) + reviewCode()
  index.ts                 # barrel re-exports + thin smoke test / entry guard
```

## Phase 1: Extract Leaf Modules

### Overview

Move schemas, prompts, and provider/model wiring out of `index.ts` into dedicated
modules. `index.ts` is updated to import from them so the package keeps compiling
and `reviewCode` behaves identically. No `ToolLoopAgent` yet.

### Changes Required:

#### 1. Review schemas module

**File**: `src/schemas/review.ts`

**Intent**: Hold the structured-output contract in one place so both the agent and
future evals import the same source of truth.

**Contract**: Export `findingSchema`, `reviewSchema` (unchanged Zod definitions
moved verbatim from `index.ts:24-35`) and the inferred `Finding` / `Review` types
(`z.infer<...>`). No logic change.

#### 2. Review prompts module

**File**: `src/prompts/review.ts`

**Intent**: Separate the wording of the review instruction and the per-call prompt
from the agent wiring, so prompts can be iterated on (and eval-compared) without
touching the agent.

**Contract**: Export `reviewInstructions` (string — the current `system` text from
`index.ts:67-69`, to be used as the agent's `instructions`) and a pure
`buildReviewPrompt(code: string, language?: string): string` helper that returns
the current prompt body from `index.ts:70` (`Review the following${language ? \` ${language}\` : ''} code:\n\n${code}`).

#### 3. Model/provider module

**File**: `src/model.ts`

**Intent**: Isolate OpenRouter provider construction and env handling as the single
swappable seam for the model.

**Contract**: Export `DEFAULT_MODEL`, `getModel(modelId?)` moved verbatim from
`index.ts:21,53-56`. `requireEnv()` (`index.ts:41-47`) moves here as a module-private
helper (not exported). Preserve the `import { ..., type LanguageModel } from 'ai'`
type-only import form.

#### 4. Re-point index.ts imports (interim)

**File**: `src/index.ts`

**Intent**: Keep the file compiling and `reviewCode` working by importing the moved
symbols, deferring the agent conversion to Phase 2.

**Contract**: Replace the inlined schema/prompt/model definitions with imports from
`./schemas/review.js`, `./prompts/review.js`, `./model.js` (note `.js` extensions
for NodeNext). `reviewCode` still calls `generateText` here for this phase, now
using `reviewInstructions` and `buildReviewPrompt(...)`. Re-export the schemas/types
and `getModel` so the public surface is unchanged at phase boundary.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] Build passes: `npm run build`
- [ ] Smoke test runs and prints a `Review` JSON: `npm start` (requires
  `OPENROUTER_API_KEY` in `.env`)

#### Manual Verification:

- [ ] `reviewCode` output shape is unchanged (summary + findings array) vs. before
  the refactor
- [ ] No symbol that was previously exported from `index.ts` is now missing

**Implementation Note**: After Phase 1 automated verification passes, pause for
manual confirmation before Phase 2.

---

## Phase 2: Assemble the ToolLoopAgent + Barrel

### Overview

Introduce the reusable `ToolLoopAgent`, move `reviewCode()` onto it, and rewrite
`index.ts` as the public barrel that re-exports the agent + `reviewCode` + schemas
and keeps a thin smoke test.

### Changes Required:

#### 1. Code reviewer agent module

**File**: `src/agents/code-reviewer.ts`

**Intent**: Define the reviewer once as a `ToolLoopAgent` with structured output,
and provide the `reviewCode()` convenience that callers (and a future promptfoo
provider) use.

**Contract**: Export `codeReviewerAgent = new ToolLoopAgent({ model: getModel(),
instructions: reviewInstructions, output: Output.object({ schema: reviewSchema }) })`
(no `tools`). Export `async reviewCode(code, language?): Promise<Review>` that calls
`const { output } = await codeReviewerAgent.generate({ prompt: buildReviewPrompt(code,
language) })` and returns `output`. Imports use `.js` extensions; `Review` is a
type-only import. Pull `ToolLoopAgent` and `Output` from `ai`.

Snippet (the agent wiring is the load-bearing contract this plan introduces):

```ts
import { ToolLoopAgent, Output } from 'ai';
import { getModel } from '../model.js';
import { reviewInstructions, buildReviewPrompt } from '../prompts/review.js';
import { reviewSchema, type Review } from '../schemas/review.js';

export const codeReviewerAgent = new ToolLoopAgent({
  model: getModel(),
  instructions: reviewInstructions,
  output: Output.object({ schema: reviewSchema }),
});

export async function reviewCode(code: string, language?: string): Promise<Review> {
  const { output } = await codeReviewerAgent.generate({
    prompt: buildReviewPrompt(code, language),
  });
  return output;
}
```

#### 2. Barrel index + smoke test

**File**: `src/index.ts`

**Intent**: Make `index.ts` the stable public entry: re-export the reviewer surface
and keep the one-command smoke test.

**Contract**: Re-export `codeReviewerAgent`, `reviewCode` (from
`./agents/code-reviewer.js`), `getModel`, `DEFAULT_MODEL` (from `./model.js`), and
`findingSchema`, `reviewSchema`, `Finding`, `Review` (from `./schemas/review.js`;
types via `export type`). Keep the `main()` smoke test (`index.ts:78-87`) and the
cross-platform `import.meta.url` entry guard (`index.ts:90-96`) calling the
re-exported `reviewCode`. No leftover `generateText` call in `index.ts`.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] Build passes: `npm run build`
- [ ] Smoke test runs and prints a `Review` JSON: `npm start`
- [ ] No remaining `generateText` import in `src/index.ts` (it now lives only in
  the agent, via `ToolLoopAgent`)

#### Manual Verification:

- [ ] `npm start` produces a review equivalent in shape/quality to the pre-refactor
  output for the sample snippet
- [ ] `import { codeReviewerAgent, reviewCode, reviewSchema } from
  '@room-pilot/code-reviewer'` resolves against the built `dist/` (export surface
  is reachable for a future eval)
- [ ] Agent is reusable: a second `reviewCode()` call in the same process reuses the
  one `codeReviewerAgent` instance (no re-construction per call)

**Implementation Note**: After Phase 2 automated verification passes, pause for
manual confirmation.

---

## Testing Strategy

### Unit Tests:

- None added in this change (package has no test runner; out of scope). The
  extracted `buildReviewPrompt` pure helper is the natural first unit-test target
  when a runner is introduced.

### Integration Tests:

- The `npm start` smoke test is the integration check: it exercises model wiring,
  prompt, agent loop, and schema validation end-to-end against OpenRouter.

### Manual Testing Steps:

1. Ensure `.env` has `OPENROUTER_API_KEY`.
2. Run `npm run typecheck` — expect no errors.
3. Run `npm start` — expect a JSON `Review` with `summary` + `findings[]`.
4. (Optional) Add a throwaway second `reviewCode()` call to confirm the shared
   agent instance is reused, then remove it.

## Performance Considerations

`codeReviewerAgent` is constructed once at module load (singleton), so repeated
`reviewCode()` calls reuse the same agent and provider — strictly better than the
current per-call `getModel()` path inside `reviewCode`. One network round-trip per
review, unchanged.

## Migration Notes

Pure internal refactor. The npm-published-style surface (`reviewCode`, `getModel`,
`findingSchema`, `reviewSchema`, `Finding`, `Review`) remains exported from the
package entry; `codeReviewerAgent` is added. No consumer outside this package today.

## References

- Change folder: `context/changes/tool-loop-agent/`
- AI SDK agent API: `node_modules/ai/docs/03-agents/02-building-agents.mdx`
- File conventions: `.agents/skills/ai-sdk/references/type-safe-agents.md`
- Output / structured-output usage: `.agents/skills/ai-sdk/references/common-errors.md`
- Original implementation: `src/index.ts:1-97`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract Leaf Modules

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Build passes: `npm run build`
- [x] 1.3 Smoke test runs and prints a `Review` JSON: `npm start`

#### Manual

- [x] 1.4 `reviewCode` output shape unchanged (summary + findings array)
- [x] 1.5 No previously-exported `index.ts` symbol is missing

### Phase 2: Assemble the ToolLoopAgent + Barrel

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Build passes: `npm run build`
- [ ] 2.3 Smoke test runs and prints a `Review` JSON: `npm start`
- [ ] 2.4 No remaining `generateText` import in `src/index.ts`

#### Manual

- [ ] 2.5 `npm start` review equivalent in shape/quality to pre-refactor
- [ ] 2.6 Public export surface resolves against built `dist/`
- [ ] 2.7 Shared `codeReviewerAgent` instance reused across `reviewCode()` calls

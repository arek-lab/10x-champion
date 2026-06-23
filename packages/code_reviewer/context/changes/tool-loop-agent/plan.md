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

Finally, a dedicated `cli.ts` entrypoint turns the package into a usable
command-line tool — review a file path argument or piped stdin, infer the
language from the file extension (override with `--language`), and print either a
human-readable report or, with `--json`, the raw `Review`. `index.ts` becomes a
side-effect-free library barrel, and `package.json` gains an explicit
`bin`/`exports` contract so the package is both importable and runnable.

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
`ToolLoopAgent` instance; the barrel `index.ts` re-exports the public API as a
**side-effect-free** library surface (no `main()`, no entry guard). A separate
`src/cli.ts` is the runnable entrypoint: `npm start` (and the installed `bin`)
review a file or piped stdin and print a human-readable report (or `--json`).
`package.json` declares an explicit `bin` + `exports` contract. `npm run
typecheck`/`npm run build` stay green; the validated `Review` shape is unchanged.
The agent instance is importable for a future promptfoo provider with no further
refactor.

### Key Discoveries:

- `ToolLoopAgent` + `Output.object` replaces `generateText` + `Output.object`
  one-to-one; `system` → `instructions`. (`building-agents.mdx:162`)
- `agent.generate({ prompt })` returns `{ output }` typed to the schema. (`building-agents.mdx:178`)
- `verbatimModuleSyntax` + NodeNext require `import type` and `.js` extensions on
  relative specifiers. (`tsconfig.json:12`, `:4`)
- OpenRouter `getModel()` returns a `LanguageModel` the agent consumes directly.
  (`src/index.ts:53`)
- The current entrypoint distinguishes "run as script" from "imported" via an
  `import.meta.url` / `pathToFileURL(process.argv[1])` guard (`src/index.ts:52`);
  that script-detection logic moves wholesale into `cli.ts`, leaving `index.ts`
  import-only.
- `package.json` is currently `main`-only with no `bin`/`exports`; `start`/`dev`
  point at `src/index.ts` (`package.json:7-9`). Phase 3 repoints them at `cli.ts`.

## What We're NOT Doing

- **Not** configuring the promptfoo/eval environment (no `promptfooconfig.yaml`,
  no eval deps, no provider adapter file). We only shape the exports so it's
  possible later.
- **Not** switching providers — OpenRouter and `openrouter/free` stay; no new deps,
  no `.env` changes.
- **Not** adding tools — the agent stays tool-free structured-output for now.
- **Not** adding a test runner, CI, or unit tests (none exist in this package).
- **Not** changing the `Review`/`Finding` schema shape or the model default.
- **Not** adding any CLI argument-parsing dependency (commander/yargs). The CLI
  uses zero-dep manual `process.argv` parsing, honoring the no-new-deps rule.
- **Not** publishing to npm or setting up a release flow — `bin`/`exports` are
  declared for local `tsx`/`dist` use and a future eval, not for publication.
- **Not** making the CLI a CI quality gate — exit code is `0` on a successful
  review regardless of findings, non-zero only on a real error (missing/empty
  input, model failure). A severity-gated `--fail-on` can be added later.
- **Not** batching multiple files / globs — the CLI reviews exactly one input
  (one file path or one stdin stream) per invocation, preserving the single
  round-trip behavior.

## Implementation Approach

Three phases, each independently typecheck-verifiable. Phase 1 extracts the leaf
modules (schemas, prompts, model) as near-verbatim moves — no behavior change,
`index.ts` keeps importing from them and stays green. Phase 2 introduces the
`ToolLoopAgent` in `agents/code-reviewer.ts`, moves `reviewCode()` onto it, and
rewrites `index.ts` as the re-export barrel + a thin **transitional** smoke test.
Phase 3 builds the real public surface: it strips the smoke test so `index.ts` is
a side-effect-free barrel, adds `src/cli.ts` as the runnable entrypoint, and
wires `bin`/`exports`/scripts in `package.json`. Splitting this way means a
regression in "extract" is isolated from "convert to agent" is isolated from
"public surface & CLI."

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
  cli.ts                   # CLI entrypoint: argv/stdin → reviewCode → report (bin)
  index.ts                 # side-effect-free library barrel (re-exports only)
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

> **Transitional**: this `main()` smoke test + entry guard is Phase 2's runtime
> verification only. Phase 3 removes it from `index.ts` (making the barrel
> side-effect-free) and relocates the script-detection logic into `cli.ts`. Do
> not build new behavior on top of the `index.ts` `main()`.

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

## Phase 3: Public Surface & CLI

### Overview

Turn the package into a real, runnable tool with a clean public boundary. Strip
the transitional smoke test so `index.ts` is a side-effect-free library barrel;
add `src/cli.ts` as the runnable entrypoint that reviews a file argument or piped
stdin and prints a human-readable report (or `--json`); and declare the
`bin`/`exports` contract plus repoint the `start`/`dev` scripts in `package.json`.

### Changes Required:

#### 1. Make `index.ts` a side-effect-free barrel

**File**: `src/index.ts`

**Intent**: Importing the package must not run a review. The barrel becomes
re-exports only; all script/entry behavior moves to `cli.ts`.

**Contract**: Remove `main()` (`index.ts:40-49` post-Phase-2 equivalent), the
`import.meta.url` entry guard (`index.ts:51-58`), and the now-unused
`node:url`/`process` imports. Keep ONLY the re-exports of `codeReviewerAgent`,
`reviewCode` (from `./agents/code-reviewer.js`), `getModel`, `DEFAULT_MODEL`
(from `./model.js`), and `findingSchema`, `reviewSchema`, `Finding`, `Review`
(from `./schemas/review.js`; types via `export type`). After this change a bare
`import '@room-pilot/code-reviewer'` performs no I/O and no model call.

#### 2. CLI entrypoint

**File**: `src/cli.ts`

**Intent**: One command that reviews real code — from a file path or piped stdin —
and renders the result for a human by default, or as raw JSON for machines.

**Contract**: A `main()` that:

- **Parses `process.argv.slice(2)`** with zero-dep manual parsing. Recognizes:
  the first non-flag token as the input file path (optional); `--json` (boolean,
  raw `Review` output); `--language <lang>` / `--language=<lang>` (override);
  `-h`/`--help` (print usage, exit `0`).
- **Resolves input** in this order: if a file path was given, read it
  (`fs/promises.readFile`, utf8); else if stdin is piped (`!process.stdin.isTTY`),
  read stdin to end; else (no path, TTY) print usage and exit `0`. A read that
  yields empty/whitespace-only content is a real error → message + exit `1`.
- **Resolves language**: explicit `--language` wins; else, when reviewing a file,
  infer from its extension via a small `ext → language` map (e.g. `.ts`→
  `typescript`, `.js`/`.mjs`/`.cjs`→`javascript`, `.py`→`python`, `.go`→`go`,
  `.rs`→`rust`, `.java`→`java`, `.rb`→`ruby`); unknown extension or stdin without
  `--language` ⇒ `undefined` (passed through to `buildReviewPrompt`).
- **Runs the review**: `const review = await reviewCode(code, language)` against
  the re-exported library surface (no direct agent construction in the CLI).
- **Renders**: `--json` ⇒ `console.log(JSON.stringify(review, null, 2))`. Default
  ⇒ a human-readable report — print `summary`, then each finding as a line keyed
  by `severity` (e.g. `[critical] L12: …`), showing `line` when non-null and the
  `suggestion` when present. The report formatter is a pure local
  `formatReview(review): string` helper so it stays testable.
- **Exit codes & errors**: success ⇒ exit `0` regardless of findings. Any real
  failure (file not found, empty input, model/network/validation error) ⇒
  `console.error(message)` + exit `1`. Keep the cross-platform
  `import.meta.url`/`pathToFileURL(process.argv[1])` guard around `main()` (moved
  from `index.ts`) so `cli.ts` also stays import-safe.

**Contract** (the script-entry guard relocated from `index.ts`, plus the new
TTY/stdin branch, is the one non-obvious piece):

```ts
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { reviewCode, type Review } from './index.js';

async function readInput(filePath?: string): Promise<string> {
  if (filePath) return readFile(filePath, 'utf8');
  if (process.stdin.isTTY) { printUsage(); process.exit(0); }
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

#### 3. `package.json` — bin, exports, scripts

**File**: `package.json`

**Intent**: Declare the public contract — the package is both importable (library)
and runnable (CLI) — and point the dev/start scripts at the new entrypoint.

**Contract**: Add `"bin": { "code-reviewer": "dist/cli.js" }`. Add an `"exports"`
map for `"."` exposing the built barrel (`"types": "./dist/index.d.ts"`,
`"import": "./dist/index.js"`). Repoint scripts: `"start"` and `"dev"` run
`src/cli.ts` (keeping the `--env-file-if-exists=.env` flag and `tsx watch` for
`dev`); `build`/`typecheck` unchanged. `main` stays `dist/index.js`.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] Build passes: `npm run build`
- [ ] No `main()` / entry guard / `node:url` import remains in `src/index.ts`
- [ ] Review a file: `npm start -- src/index.ts` prints a human-readable report
- [ ] JSON mode: `npm start -- --json src/index.ts` prints a valid `Review` JSON
- [ ] Stdin path: `Get-Content src/index.ts | npm start -- --language typescript`
  produces a report (PowerShell pipe)

#### Manual Verification:

- [ ] Default output is readable (summary + severity-tagged findings with line
  numbers and suggestions), `--json` gives the raw object
- [ ] `--language` override beats extension inference; unknown extension / bare
  stdin still works (language `undefined`)
- [ ] Error paths exit non-zero with a clear message: missing file, empty input;
  a successful review exits `0` even with critical findings
- [ ] No-arg `npm start` on a TTY prints usage and exits `0`
- [ ] `import { reviewCode } from '@room-pilot/code-reviewer'` triggers no review
  on import (barrel is side-effect-free)

**Implementation Note**: After Phase 3 automated verification passes, pause for
manual confirmation.

---

## Testing Strategy

### Unit Tests:

- None added in this change (package has no test runner; out of scope). The
  extracted `buildReviewPrompt` and the new `formatReview` pure helpers are the
  natural first unit-test targets when a runner is introduced (both are
  deterministic and model-free).

### Integration Tests:

- The `npm start` smoke test is the integration check: it exercises model wiring,
  prompt, agent loop, and schema validation end-to-end against OpenRouter.

### Manual Testing Steps:

1. Ensure `.env` has `OPENROUTER_API_KEY`.
2. Run `npm run typecheck` — expect no errors.
3. (Phase 2) Run `npm start` — expect a JSON `Review` with `summary` +
   `findings[]` from the transitional smoke test.
4. (Phase 3) Run `npm start -- src/index.ts` — expect a human-readable report;
   add `--json` for the raw object; pipe a file via stdin with `--language` to
   verify the stdin branch.
5. (Phase 3) Verify error paths: a missing file path and an empty file both exit
   non-zero with a clear message; a successful review exits `0`.
6. (Optional) Add a throwaway second `reviewCode()` call to confirm the shared
   agent instance is reused, then remove it.

## Performance Considerations

`codeReviewerAgent` is constructed once at module load (singleton), so repeated
`reviewCode()` calls reuse the same agent and provider — strictly better than the
current per-call `getModel()` path inside `reviewCode`. One network round-trip per
review, unchanged.

## Migration Notes

Mostly an internal refactor. The library surface (`reviewCode`, `getModel`,
`findingSchema`, `reviewSchema`, `Finding`, `Review`) remains exported from the
package entry; `codeReviewerAgent` is added. No consumer outside this package
today. The one behavioral delta is the entrypoint: after Phase 3, `npm start` no
longer reviews a hardcoded sample — it expects a file argument or piped stdin, and
prints a usage message on a bare TTY invocation. The smoke-test sample is gone;
re-run the review with a real input instead.

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

- [x] 1.1 Type checking passes: `npm run typecheck` — 671d917
- [x] 1.2 Build passes: `npm run build` — 671d917
- [x] 1.3 Smoke test runs and prints a `Review` JSON: `npm start` — 671d917

#### Manual

- [x] 1.4 `reviewCode` output shape unchanged (summary + findings array) — 671d917
- [x] 1.5 No previously-exported `index.ts` symbol is missing — 671d917

### Phase 2: Assemble the ToolLoopAgent + Barrel

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck`
- [x] 2.2 Build passes: `npm run build`
- [x] 2.3 Smoke test runs and prints a `Review` JSON: `npm start`
- [x] 2.4 No remaining `generateText` import in `src/index.ts`

#### Manual

- [x] 2.5 `npm start` review equivalent in shape/quality to pre-refactor
- [x] 2.6 Public export surface resolves against built `dist/`
- [x] 2.7 Shared `codeReviewerAgent` instance reused across `reviewCode()` calls

### Phase 3: Public Surface & CLI

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Build passes: `npm run build`
- [ ] 3.3 No `main()` / entry guard / `node:url` import remains in `src/index.ts`
- [ ] 3.4 `npm start -- src/index.ts` prints a human-readable report
- [ ] 3.5 `npm start -- --json src/index.ts` prints valid `Review` JSON
- [ ] 3.6 Stdin path produces a report (`Get-Content … | npm start -- --language typescript`)

#### Manual

- [ ] 3.7 Default output readable; `--json` gives raw object
- [ ] 3.8 `--language` override beats extension inference; unknown ext / bare stdin works
- [ ] 3.9 Error paths exit non-zero with clear message; successful review exits `0`
- [ ] 3.10 No-arg `npm start` on a TTY prints usage and exits `0`
- [ ] 3.11 Importing the package triggers no review (barrel side-effect-free)

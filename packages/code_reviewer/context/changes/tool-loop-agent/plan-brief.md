# Tool Loop Agent — Modular Code Reviewer — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`

## What & Why

Refactor the single-file `packages/code_reviewer/src/index.ts` into a modular,
reusable code-review agent built on the AI SDK's `ToolLoopAgent`, and give the
package a real public surface: a side-effect-free library barrel plus a runnable
`cli.ts` (review a file or piped stdin). Goal: a clean, importable surface a
future promptfoo eval can drive, and a usable command-line tool today — without
configuring the eval environment in this change.

## Starting Point

Today `index.ts` (97 lines) bundles provider/model wiring, Zod schemas,
`reviewCode()` (a `generateText` + `Output.object` call — not an agent, no tools),
and a smoke test. Provider is OpenRouter with the `openrouter/free` default.

## Desired End State

`src/` is split into `schemas/review.ts`, `prompts/review.ts`, `model.ts`,
`agents/code-reviewer.ts`, and `cli.ts`. The reviewer is a single `ToolLoopAgent`
instance with structured output; `reviewCode()` calls `agent.generate()`.
`index.ts` is a **side-effect-free** barrel re-exporting the agent + `reviewCode()`
+ schemas. `cli.ts` is the runnable entrypoint (`npm start` / installed `bin`):
review a file path or piped stdin, language inferred from extension (override
`--language`), human-readable report by default or `--json`. `package.json`
declares `bin` + `exports`. The validated `Review` shape is unchanged.

## Key Decisions Made

| Decision            | Choice                                          | Why (1 sentence)                                                              | Source |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Export surface      | Agent instance + `reviewCode()` + schemas       | Promptfoo can wrap either the function or the agent later with zero coupling. | Plan   |
| Module layout       | `agents/` + `prompts/` + `schemas/` + `model.ts`| Matches the AI SDK skill's `agents/`/`tools/` convention; scales to tools.    | Plan   |
| Provider            | Keep OpenRouter (`openrouter/free`)             | Don't break the working setup; no new deps or `.env` churn.                   | Plan   |
| Tools               | Tool-free structured-output agent               | Faithful 1:1 conversion; `ToolLoopAgent` supports tool-free `Output.object`.  | Plan   |
| Smoke test          | Keep thin `main()` in `index.ts` (Phase 2 only) | Transitional runtime check; Phase 3 removes it for a side-effect-free barrel. | Plan   |
| CLI input           | File path arg + piped stdin                     | Covers `reviewer foo.ts` and `cat foo.ts \| reviewer` from one entrypoint.    | Plan   |
| CLI output          | Human-readable default, `--json` toggles        | Good terminal DX plus a machine mode for CI / future promptfoo.              | Plan   |
| Language hint       | Infer from extension, `--language` overrides    | Zero-config for files; explicit override for stdin / unusual extensions.      | Plan   |
| Public surface      | Pure `index.ts` barrel + `cli.ts` (bin/exports) | Import never runs a review; explicit ESM contract for consumers and evals.    | Plan   |
| CLI arg parsing     | Zero-dep manual `process.argv`                  | Honors the no-new-deps rule; the surface is small enough not to need a lib.   | Plan   |
| Exit codes          | `0` on success, non-zero only on real error     | CLI is a reporter, not a CI gate; severity gating can come later.            | Plan   |

## Scope

**In scope:** module split (schemas/prompts/model/agent); `ToolLoopAgent` conversion;
side-effect-free barrel `index.ts`; `cli.ts` entrypoint (file/stdin, language
inference, human/`--json` output, error handling); `package.json` `bin`/`exports`
+ repointed `start`/`dev` scripts; stable export surface for future evals.

**Out of scope:** promptfoo/eval config + deps; provider switch; adding tools; test
runner/CI; schema or model-default changes; CLI arg-parsing deps; multi-file/glob
batch review; CLI as a severity CI gate; npm publishing/release flow.

## Architecture / Approach

`model.ts` (OpenRouter `getModel`) → consumed by `agents/code-reviewer.ts`, which
builds one `ToolLoopAgent({ model, instructions, output: Output.object(reviewSchema) })`
and exposes `reviewCode()`. `prompts/review.ts` supplies `reviewInstructions` +
`buildReviewPrompt()`; `schemas/review.ts` owns the Zod contract. `index.ts` is the
re-export barrel + smoke-test entry guard. NodeNext means `.js` import extensions;
`verbatimModuleSyntax` means `import type` for types.

## Phases at a Glance

| Phase                          | What it delivers                                   | Key risk                                        |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------- |
| 1. Extract leaf modules ✅      | schemas/prompts/model split; `index.ts` still green | Missing `.js` extension / type-only import breaks NodeNext build |
| 2. Assemble agent + barrel     | `ToolLoopAgent` + `reviewCode()` + barrel `index.ts` | `ToolLoopAgent` + `Output.object` call shape differs from `generateText` |
| 3. Public surface & CLI        | side-effect-free barrel + `cli.ts` + `bin`/`exports` | stdin/TTY branch + ext→language map edge cases; barrel left with a side effect |

**Prerequisites:** `OPENROUTER_API_KEY` in `.env` for any live review; `ai` v6 +
`@openrouter/ai-sdk-provider` already installed. Phase 1 is landed (commit
671d917); Phase 3 builds on Phase 2's barrel.
**Estimated effort:** ~1–2 sessions, 3 phases (Phase 1 done).

## Open Risks & Assumptions

- Assumes `agent.generate({ prompt })` returns `{ output }` typed to the schema
  (verified against `node_modules/ai/docs`); if the installed `ai` version differs,
  re-check `building-agents.mdx`.
- `openrouter/free` must keep advertising `structured_outputs`; if a run fails,
  set `OPENROUTER_MODEL` to a structured-output-capable model.
- Stdin handling differs across shells/OS; the TTY-vs-pipe detection
  (`process.stdin.isTTY`) is the load-bearing branch — verify under PowerShell.

## Success Criteria (Summary)

- `npm run typecheck` and `npm run build` pass after each phase.
- `npm start -- <file>` prints a readable review; `--json` prints the raw
  `Review`; piped stdin with `--language` works too.
- A successful review exits `0` (even with critical findings); missing/empty
  input exits non-zero with a clear message.
- `codeReviewerAgent`, `reviewCode`, and `reviewSchema` are importable from the
  package entry with no side effect on import — ready for a future promptfoo
  provider.

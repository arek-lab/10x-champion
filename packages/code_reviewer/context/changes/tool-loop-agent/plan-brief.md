# Tool Loop Agent — Modular Code Reviewer — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`

## What & Why

Refactor the single-file `packages/code_reviewer/src/index.ts` into a modular,
reusable code-review agent built on the AI SDK's `ToolLoopAgent`. Schemas and
prompts become their own modules; the reviewer becomes an importable agent
instance. Goal: a clean, reusable surface that a future promptfoo eval can drive —
without configuring the eval environment in this change.

## Starting Point

Today `index.ts` (97 lines) bundles provider/model wiring, Zod schemas,
`reviewCode()` (a `generateText` + `Output.object` call — not an agent, no tools),
and a smoke test. Provider is OpenRouter with the `openrouter/free` default.

## Desired End State

`src/` is split into `schemas/review.ts`, `prompts/review.ts`, `model.ts`, and
`agents/code-reviewer.ts`. The reviewer is a single `ToolLoopAgent` instance with
structured output; `reviewCode()` calls `agent.generate()`. `index.ts` is a barrel
re-exporting the agent + `reviewCode()` + schemas, and still runs a one-command
smoke test (`npm start`). Behavior and the validated `Review` shape are unchanged.

## Key Decisions Made

| Decision            | Choice                                          | Why (1 sentence)                                                              | Source |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Export surface      | Agent instance + `reviewCode()` + schemas       | Promptfoo can wrap either the function or the agent later with zero coupling. | Plan   |
| Module layout       | `agents/` + `prompts/` + `schemas/` + `model.ts`| Matches the AI SDK skill's `agents/`/`tools/` convention; scales to tools.    | Plan   |
| Provider            | Keep OpenRouter (`openrouter/free`)             | Don't break the working setup; no new deps or `.env` churn.                   | Plan   |
| Tools               | Tool-free structured-output agent               | Faithful 1:1 conversion; `ToolLoopAgent` supports tool-free `Output.object`.  | Plan   |
| Smoke test          | Keep thin `main()` in `index.ts`                | Preserves the existing one-command sanity check before evals exist.          | Plan   |

## Scope

**In scope:** module split (schemas/prompts/model/agent); `ToolLoopAgent` conversion;
barrel `index.ts`; thin smoke test; stable export surface for future evals.

**Out of scope:** promptfoo/eval config + deps; provider switch; adding tools; test
runner/CI; schema or model-default changes; npm script changes.

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
| 1. Extract leaf modules        | schemas/prompts/model split; `index.ts` still green | Missing `.js` extension / type-only import breaks NodeNext build |
| 2. Assemble agent + barrel     | `ToolLoopAgent` + `reviewCode()` + barrel `index.ts` | `ToolLoopAgent` + `Output.object` call shape differs from `generateText` |

**Prerequisites:** `OPENROUTER_API_KEY` in `.env` for the smoke test; `ai` v6 +
`@openrouter/ai-sdk-provider` already installed.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes `agent.generate({ prompt })` returns `{ output }` typed to the schema
  (verified against `node_modules/ai/docs`); if the installed `ai` version differs,
  re-check `building-agents.mdx`.
- `openrouter/free` must keep advertising `structured_outputs`; if a run fails,
  set `OPENROUTER_MODEL` to a structured-output-capable model.

## Success Criteria (Summary)

- `npm run typecheck` and `npm run build` pass after each phase.
- `npm start` prints a validated `Review` (summary + findings) equivalent to before.
- `codeReviewerAgent`, `reviewCode`, and `reviewSchema` are importable from the
  package entry — ready for a future promptfoo provider.

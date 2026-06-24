# Code Review Criteria

The AI reviewer scores every pull request against the five criteria below. Each
criterion is scored **1 (worst) – 10 (best)**. These ids are load-bearing: they
match the keys of `scores` in `src/schemas/review.ts` and the rubric used by the
promptfoo eval. Keep the two in sync.

The PR is tailored to this repo: an **Astro 6 SSR app** (React 19 islands,
Tailwind 4, Supabase auth, shadcn/ui, deployed to Cloudflare Workers) whose
conventions live in `CLAUDE.md`.

---

## 1. `correctness` — Correctness & robustness

Does the change actually do what it claims, across the obvious edge cases, with
errors handled rather than swallowed?

- **1** — Logic is broken or contradicts the PR's stated intent; crashes on the
  happy path; promises are unawaited; errors are ignored or caught-and-dropped.
- **10** — Behaviour is correct and complete; edge cases (empty input, nulls,
  failed `await`, network/Supabase errors) are handled deliberately; no obvious
  bug, race, or unhandled rejection.

## 2. `security` — Security & data safety

Are auth, input validation, and secrets handled safely for an SSR app on the
edge?

- **1** — Injectable queries (string-built SQL), missing/with-broken RLS,
  unvalidated request bodies, or server secrets (`SUPABASE_KEY`, API keys)
  exposed to the client / committed.
- **10** — Inputs validated with zod at the boundary; Supabase access goes
  through RLS with per-operation, per-role policies; secrets stay server-only
  via `astro:env/server`; protected routes enforced in middleware; no injection
  or auth-bypass surface.

## 3. `conventions` — Conventions & architecture fit

Does the code follow the project's documented conventions in `CLAUDE.md`?

- **1** — Fights the stack: Next.js directives (`"use client"`), React used for
  static markup, hand-concatenated class strings, API routes missing
  `prerender = false`, ad-hoc folders, migrations without RLS.
- **10** — Idiomatic: React only for interactive islands wired with `client:*`,
  `.astro` for layout/static, `cn()` for class merging, `@/*` path alias, zod on
  API routes, shadcn/ui in `src/components/ui/`, services in `src/lib/`, shared
  types in `src/types.ts`.

## 4. `readability` — Readability & maintainability

Will the next developer (or agent) understand and safely change this code?

- **1** — Cryptic names, dead code, copy-paste duplication, giant functions,
  comments that lie or restate the obvious; style clashes with surrounding code.
- **10** — Clear intent-revealing names, small focused units, no duplication;
  comment density and idiom match the surrounding file; diff is minimal and
  scoped to the change.

## 5. `testing` — Test coverage & verifiability

Is the change covered by appropriate, trustworthy tests?

- **1** — No tests for changed behaviour, or tests that are flaky/coupled:
  `page.waitForTimeout()`, CSS/XPath locators, shared state between tests, no
  cleanup.
- **10** — Meaningful unit (vitest) and/or E2E (Playwright) coverage for the new
  behaviour; tests are independent with their own setup/cleanup and unique ids;
  accessible locators (`getByRole`/`getByLabel`/`getByText`); waits on state,
  never on timers.

---

## Verdict

- `score` — overall quality **1–10** (holistic, not a strict average).
- `verdict` — `pass` or `fail`. A PR **fails** if the overall `score` is ≤ 4 or
  any `critical` finding is present; otherwise it `pass`es. This is the
  machine-readable merge gate read by CI.

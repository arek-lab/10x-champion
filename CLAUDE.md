# CLAUDE.md

## Commands

 @README.md

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

Full SSR (`output: "server"`). API routes must export `const prerender = false`.

### Key conventions

- Path alias `@/*` → `./src/*` (tsconfig)
- Astro components for layout/static;Use React only for
   components that require useState, useEffect, or browser event handlers — wire with a client:* directive. Static content, layout wrappers, and navigation use .astro components.
- Tailwind merging: use `cn()` from `@/lib/utils` — never concatenate class strings manually
- shadcn/ui in `src/components/ui/`, new-york style; add with `npx shadcn@latest add [name]`
- API routes: uppercase `GET`/`POST` exports; validate with zod
- Supabase migrations: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`; always enable RLS with per-operation, per-role policies
- No Next.js directives (`"use client"` etc.); hooks go in `src/components/hooks/`
- Services/helpers in `src/lib/`; shared types/DTOs in `src/types.ts`

### Auth flow

- `src/lib/supabase.ts` — Supabase SSR client with cookie sessions; `SUPABASE_URL`/`SUPABASE_KEY` via `astro:env/server`
- `src/middleware.ts` — resolves user on every request, attaches to `context.locals.user`, redirects from `PROTECTED_ROUTES`
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`

### Environment

- Node.js v22.14.0 (`.nvmrc`)
- Copy `.env.example` → `.env` for Node; use `.dev.vars` for Cloudflare local dev (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler login`)

## CI
@.github/workflows/ci.yml.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->

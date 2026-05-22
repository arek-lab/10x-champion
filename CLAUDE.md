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
